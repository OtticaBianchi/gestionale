import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    
    const query = searchParams.get('q');
    const type = searchParams.get('type') || 'all'; // all, cliente, prodotto, fornitore
    const includeArchived = searchParams.get('includeArchived') === 'true';

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    const searchTerm = query.trim();
    console.log('🔍 Advanced search:', { searchTerm, type, includeArchived });

    const results: any[] = [];

    // Calcola la data limite per l'archiviazione (7 giorni fa)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Funzione helper per determinare se una busta è archiviata
    const isBustaArchived = (busta: any) => {
      if (busta.stato_attuale !== 'consegnato_pagato') return false;
      const updatedAt = new Date(busta.updated_at);
      return updatedAt < sevenDaysAgo;
    };

    // Ricerca per CLIENTE (nome/cognome)
    if (type === 'all' || type === 'cliente') {
      const { data: clienti, error: clientiError } = await supabase
        .from('clienti')
        .select(`
          id, nome, cognome, telefono, email,
          buste (
            id, readable_id, stato_attuale, data_apertura, updated_at,
            tipo_lavorazione, priorita, note_generali
          )
        `)
        .or(`cognome.ilike.%${searchTerm}%,nome.ilike.%${searchTerm}%`)
        .order('cognome')
        .limit(20);

      if (!clientiError && clienti) {
        clienti.forEach(cliente => {
          const buste = cliente.buste?.filter((busta: any) => {
            const isArchived = isBustaArchived(busta);
            return includeArchived || !isArchived;
          }) || [];

          if (buste.length > 0 || type === 'cliente') {
            results.push({
              type: 'cliente',
              cliente,
              buste: buste.map((busta: any) => ({
                ...busta,
                isArchived: isBustaArchived(busta)
              })),
              matchField: 'nome/cognome'
            });
          }
        });
      }
    }

    // Ricerca per PRODOTTO/CATEGORIA (lenti, LAC, montature, laboratorio, sport)
    if (type === 'all' || type === 'prodotto') {
      // Mappa dei termini di ricerca alle categorie
      const termToCategories: { [key: string]: string[] } = {
        'lenti': ['LENTI'],
        'lente': ['LENTI'],
        'lac': ['LAC'],
        'montature': ['MONTATURE'],
        'montatura': ['MONTATURE'],
        'laboratorio': ['LABORATORIO'],
        'lab': ['LABORATORIO'],
        'sport': ['SPORT']
      };

      const searchCategories = termToCategories[searchTerm.toLowerCase()] || [];

      // Se il termine corrisponde a una categoria, cerca per foreign key
      if (searchCategories.length > 0) {
        for (const categoria of searchCategories) {
          let campoFornitore = '';
          switch (categoria) {
            case 'LENTI':
              campoFornitore = 'fornitore_lenti_id';
              break;
            case 'LAC':
              campoFornitore = 'fornitore_lac_id';
              break;
            case 'MONTATURE':
              campoFornitore = 'fornitore_montature_id';
              break;
            case 'LABORATORIO':
              campoFornitore = 'fornitore_lab_esterno_id';
              break;
            case 'SPORT':
              campoFornitore = 'fornitore_sport_id';
              break;
          }

          if (campoFornitore) {
            const { data: ordiniCategoria, error: ordiniCategoriaError } = await supabase
              .from('ordini_materiali')
              .select(`
                id, descrizione_prodotto, stato, note,
                buste (
                  id, readable_id, stato_attuale, updated_at, data_apertura,
                  clienti (id, nome, cognome)
                )
              `)
              .not(campoFornitore, 'is', null)
              .limit(30);

            if (!ordiniCategoriaError && ordiniCategoria) {
              ordiniCategoria.forEach(ordine => {
                if (ordine.buste) {
                  const isArchived = isBustaArchived(ordine.buste);
                  if (includeArchived || !isArchived) {
                    results.push({
                      type: 'categoria',
                      categoria,
                      prodotto: {
                        id: ordine.id,
                        descrizione: ordine.descrizione_prodotto,
                        stato: ordine.stato,
                        note: ordine.note
                      },
                      busta: {
                        ...ordine.buste,
                        isArchived
                      },
                      cliente: ordine.buste.clienti,
                      matchField: `categoria ${categoria.toLowerCase()}`
                    });
                  }
                }
              });
            }
          }
        }
      }

      // Cerca anche nei materiali per tipo
      const { data: materiali, error: materialiError } = await supabase
        .from('materiali')
        .select(`
          id, tipo, codice_prodotto, fornitore, stato, note,
          buste (
            id, readable_id, stato_attuale, updated_at, data_apertura,
            clienti (id, nome, cognome)
          )
        `)
        .or(`tipo.ilike.%${searchTerm}%,codice_prodotto.ilike.%${searchTerm}%,note.ilike.%${searchTerm}%`)
        .limit(30);

      if (!materialiError && materiali) {
        materiali.forEach(materiale => {
          if (materiale.buste) {
            const isArchived = isBustaArchived(materiale.buste);
            if (includeArchived || !isArchived) {
              results.push({
                type: 'prodotto',
                prodotto: {
                  id: materiale.id,
                  descrizione: materiale.tipo,
                  codice: materiale.codice_prodotto,
                  fornitore: materiale.fornitore,
                  note: materiale.note
                },
                busta: {
                  ...materiale.buste,
                  isArchived
                },
                cliente: materiale.buste.clienti,
                matchField: 'materiale'
              });
            }
          }
        });
      }
    }

    // Ricerca per FORNITORE - mostra buste che hanno ordinato da quel fornitore
    if (type === 'all' || type === 'fornitore') {
      // Cerca fornitori lenti
      const { data: forniLenti, error: forniLentiError } = await supabase
        .from('fornitori_lenti')
        .select('id, nome, telefono, email, tempi_consegna_medi')
        .ilike('nome', `%${searchTerm}%`)
        .limit(5);

      if (!forniLentiError && forniLenti) {
        for (const fornitore of forniLenti) {
          const { data: ordini, error: ordiniError } = await supabase
            .from('ordini_materiali')
            .select(`
              id, descrizione_prodotto, stato, data_ordine, note,
              buste (
                id, readable_id, stato_attuale, updated_at, data_apertura,
                clienti (id, nome, cognome)
              )
            `)
            .eq('fornitore_lenti_id', fornitore.id)
            .limit(10);

          if (!ordiniError && ordini) {
            ordini.forEach(ordine => {
              if (ordine.buste) {
                const isArchived = isBustaArchived(ordine.buste);
                if (includeArchived || !isArchived) {
                  results.push({
                    type: 'fornitore',
                    fornitore: {
                      nome: fornitore.nome,
                      categoria: 'LENTI',
                      telefono: fornitore.telefono,
                      tempi_consegna_medi: fornitore.tempi_consegna_medi
                    },
                    ordine: {
                      id: ordine.id,
                      descrizione: ordine.descrizione_prodotto,
                      stato: ordine.stato,
                      data_ordine: ordine.data_ordine,
                      note: ordine.note
                    },
                    busta: {
                      ...ordine.buste,
                      isArchived
                    },
                    cliente: ordine.buste.clienti,
                    matchField: 'lenti'
                  });
                }
              }
            });
          }
        }
      }

      // Cerca fornitori LAC
      const { data: forniLac, error: forniLacError } = await supabase
        .from('fornitori_lac')
        .select('id, nome, telefono, email, tempi_consegna_medi')
        .ilike('nome', `%${searchTerm}%`)
        .limit(5);

      if (!forniLacError && forniLac) {
        for (const fornitore of forniLac) {
          const { data: ordini, error: ordiniError } = await supabase
            .from('ordini_materiali')
            .select(`
              id, descrizione_prodotto, stato, data_ordine, note,
              buste (
                id, readable_id, stato_attuale, updated_at, data_apertura,
                clienti (id, nome, cognome)
              )
            `)
            .eq('fornitore_lac_id', fornitore.id)
            .limit(10);

          if (!ordiniError && ordini) {
            ordini.forEach(ordine => {
              if (ordine.buste) {
                const isArchived = isBustaArchived(ordine.buste);
                if (includeArchived || !isArchived) {
                  results.push({
                    type: 'fornitore',
                    fornitore: {
                      nome: fornitore.nome,
                      categoria: 'LAC',
                      telefono: fornitore.telefono,
                      tempi_consegna_medi: fornitore.tempi_consegna_medi
                    },
                    ordine: {
                      id: ordine.id,
                      descrizione: ordine.descrizione_prodotto,
                      stato: ordine.stato,
                      data_ordine: ordine.data_ordine,
                      note: ordine.note
                    },
                    busta: {
                      ...ordine.buste,
                      isArchived
                    },
                    cliente: ordine.buste.clienti,
                    matchField: 'lac'
                  });
                }
              }
            });
          }
        }
      }

      // Cerca fornitori montature
      const { data: forniMontature, error: forniMontatoreError } = await supabase
        .from('fornitori_montature')
        .select('id, nome, telefono, email, tempi_consegna_medi')
        .ilike('nome', `%${searchTerm}%`)
        .limit(5);

      if (!forniMontatoreError && forniMontature) {
        for (const fornitore of forniMontature) {
          const { data: ordini, error: ordiniError } = await supabase
            .from('ordini_materiali')
            .select(`
              id, descrizione_prodotto, stato, data_ordine, note,
              buste (
                id, readable_id, stato_attuale, updated_at, data_apertura,
                clienti (id, nome, cognome)
              )
            `)
            .eq('fornitore_montature_id', fornitore.id)
            .limit(10);

          if (!ordiniError && ordini) {
            ordini.forEach(ordine => {
              if (ordine.buste) {
                const isArchived = isBustaArchived(ordine.buste);
                if (includeArchived || !isArchived) {
                  results.push({
                    type: 'fornitore',
                    fornitore: {
                      nome: fornitore.nome,
                      categoria: 'MONTATURE',
                      telefono: fornitore.telefono,
                      tempi_consegna_medi: fornitore.tempi_consegna_medi
                    },
                    ordine: {
                      id: ordine.id,
                      descrizione: ordine.descrizione_prodotto,
                      stato: ordine.stato,
                      data_ordine: ordine.data_ordine,
                      note: ordine.note
                    },
                    busta: {
                      ...ordine.buste,
                      isArchived
                    },
                    cliente: ordine.buste.clienti,
                    matchField: 'montature'
                  });
                }
              }
            });
          }
        }
      }

      // Cerca fornitori sport
      const { data: forniSport, error: forniSportError } = await supabase
        .from('fornitori_sport')
        .select('id, nome, telefono, email, tempi_consegna_medi')
        .ilike('nome', `%${searchTerm}%`)
        .limit(5);

      if (!forniSportError && forniSport) {
        for (const fornitore of forniSport) {
          const { data: ordini, error: ordiniError } = await supabase
            .from('ordini_materiali')
            .select(`
              id, descrizione_prodotto, stato, data_ordine, note,
              buste (
                id, readable_id, stato_attuale, updated_at, data_apertura,
                clienti (id, nome, cognome)
              )
            `)
            .eq('fornitore_sport_id', fornitore.id)
            .limit(10);

          if (!ordiniError && ordini) {
            ordini.forEach(ordine => {
              if (ordine.buste) {
                const isArchived = isBustaArchived(ordine.buste);
                if (includeArchived || !isArchived) {
                  results.push({
                    type: 'fornitore',
                    fornitore: {
                      nome: fornitore.nome,
                      categoria: 'SPORT',
                      telefono: fornitore.telefono,
                      tempi_consegna_medi: fornitore.tempi_consegna_medi
                    },
                    ordine: {
                      id: ordine.id,
                      descrizione: ordine.descrizione_prodotto,
                      stato: ordine.stato,
                      data_ordine: ordine.data_ordine,
                      note: ordine.note
                    },
                    busta: {
                      ...ordine.buste,
                      isArchived
                    },
                    cliente: ordine.buste.clienti,
                    matchField: 'sport'
                  });
                }
              }
            });
          }
        }
      }

      // Cerca fornitori laboratorio esterno
      const { data: forniLab, error: forniLabError } = await supabase
        .from('fornitori_lab_esterno')
        .select('id, nome, telefono, email, tempi_consegna_medi')
        .ilike('nome', `%${searchTerm}%`)
        .limit(5);

      if (!forniLabError && forniLab) {
        for (const fornitore of forniLab) {
          const { data: ordini, error: ordiniError } = await supabase
            .from('ordini_materiali')
            .select(`
              id, descrizione_prodotto, stato, data_ordine, note,
              buste (
                id, readable_id, stato_attuale, updated_at, data_apertura,
                clienti (id, nome, cognome)
              )
            `)
            .eq('fornitore_lab_esterno_id', fornitore.id)
            .limit(10);

          if (!ordiniError && ordini) {
            ordini.forEach(ordine => {
              if (ordine.buste) {
                const isArchived = isBustaArchived(ordine.buste);
                if (includeArchived || !isArchived) {
                  results.push({
                    type: 'fornitore',
                    fornitore: {
                      nome: fornitore.nome,
                      categoria: 'LABORATORIO',
                      telefono: fornitore.telefono,
                      tempi_consegna_medi: fornitore.tempi_consegna_medi
                    },
                    ordine: {
                      id: ordine.id,
                      descrizione: ordine.descrizione_prodotto,
                      stato: ordine.stato,
                      data_ordine: ordine.data_ordine,
                      note: ordine.note
                    },
                    busta: {
                      ...ordine.buste,
                      isArchived
                    },
                    cliente: ordine.buste.clienti,
                    matchField: 'laboratorio'
                  });
                }
              }
            });
          }
        }
      }

      // PRIORITÀ MASSIMA: Cerca nei materiali per fornitore (campo stringa)
      // Qui dovrebbero essere i brand come Ray-Ban, Luxottica, ecc.
      const { data: materialiFornitori, error: matFornitoriError } = await supabase
        .from('materiali')
        .select(`
          id, fornitore, fornitore_id, tipo, stato, note,
          buste (
            id, readable_id, stato_attuale, updated_at, data_apertura,
            clienti (id, nome, cognome)
          )
        `)
        .ilike('fornitore', `%${searchTerm}%`)
        .not('fornitore', 'is', null)
        .limit(50);

      console.log(`🔍 MATERIALI search for "${searchTerm}":`, materialiFornitori?.length || 0, 'results');

      if (!matFornitoriError && materialiFornitori && materialiFornitori.length > 0) {
        materialiFornitori.forEach(materiale => {
          if (materiale.buste) {
            const isArchived = isBustaArchived(materiale.buste);
            if (includeArchived || !isArchived) {
              results.push({
                type: 'fornitore',
                fornitore: {
                  nome: materiale.fornitore,
                  categoria: 'BRAND'
                },
                materiale: {
                  id: materiale.id,
                  tipo: materiale.tipo,
                  stato: materiale.stato,
                  note: materiale.note
                },
                busta: {
                  ...materiale.buste,
                  isArchived
                },
                cliente: materiale.buste.clienti,
                matchField: 'brand materiale'
              });
            }
          }
        });
      }

      // FALLBACK: Se non trovo nulla nei materiali, cerca nelle descrizioni prodotti
      if (materialiFornitori?.length === 0) {
        console.log(`🔍 FALLBACK - Searching in descrizione_prodotto for "${searchTerm}"`);
        
        const { data: ordiniConBrand, error: ordiniConBrandError } = await supabase
          .from('ordini_materiali')
          .select(`
            id, descrizione_prodotto, stato, data_ordine, note,
            buste (
              id, readable_id, stato_attuale, updated_at, data_apertura,
              clienti (id, nome, cognome)
            )
          `)
          .ilike('descrizione_prodotto', `%${searchTerm}%`)
          .limit(30);

        console.log(`🔍 ORDINI fallback search:`, ordiniConBrand?.length || 0, 'results');

        if (!ordiniConBrandError && ordiniConBrand) {
          ordiniConBrand.forEach(ordine => {
            if (ordine.buste) {
              const isArchived = isBustaArchived(ordine.buste);
              if (includeArchived || !isArchived) {
                results.push({
                  type: 'fornitore',
                  fornitore: {
                    nome: searchTerm,
                    categoria: 'BRAND'
                  },
                  ordine: {
                    id: ordine.id,
                    descrizione: ordine.descrizione_prodotto,
                    stato: ordine.stato,
                    data_ordine: ordine.data_ordine,
                    note: ordine.note
                  },
                  busta: {
                    ...ordine.buste,
                    isArchived
                  },
                  cliente: ordine.buste.clienti,
                  matchField: 'brand prodotto'
                });
              }
            }
          });
        }
      }
    }

    // Rimuovi duplicati e ordina per rilevanza
    const uniqueResults = results.filter((result, index, self) => {
      if (result.type === 'cliente') {
        return self.findIndex(r => r.type === 'cliente' && r.cliente?.id === result.cliente?.id) === index;
      }
      return true;
    });

    console.log(`📋 Advanced search found ${uniqueResults.length} results`);

    return NextResponse.json({ 
      results: uniqueResults.slice(0, 50), // Limita a 50 risultati totali
      total: uniqueResults.length,
      searchTerm,
      type,
      includeArchived
    });

  } catch (error) {
    console.error('Advanced search error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}