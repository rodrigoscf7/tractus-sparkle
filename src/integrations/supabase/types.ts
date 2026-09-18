export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_acoes: {
        Row: {
          acao: string
          ator_user_id: string | null
          conta_id: string | null
          criado_em: string
          detalhes: Json
          id: string
        }
        Insert: {
          acao: string
          ator_user_id?: string | null
          conta_id?: string | null
          criado_em?: string
          detalhes?: Json
          id?: string
        }
        Update: {
          acao?: string
          ator_user_id?: string | null
          conta_id?: string | null
          criado_em?: string
          detalhes?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_acoes_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
        ]
      }
      agentes_status: {
        Row: {
          agente_nome: string
          atualizado_em: string | null
          estado_atual: string | null
          ultima_acao: string | null
        }
        Insert: {
          agente_nome: string
          atualizado_em?: string | null
          estado_atual?: string | null
          ultima_acao?: string | null
        }
        Update: {
          agente_nome?: string
          atualizado_em?: string | null
          estado_atual?: string | null
          ultima_acao?: string | null
        }
        Relationships: []
      }
      artes: {
        Row: {
          briefing: Json | null
          conta_id: string | null
          criado_em: string | null
          id: string
          pauta_id: string | null
          status: string | null
          versao: number | null
        }
        Insert: {
          briefing?: Json | null
          conta_id?: string | null
          criado_em?: string | null
          id?: string
          pauta_id?: string | null
          status?: string | null
          versao?: number | null
        }
        Update: {
          briefing?: Json | null
          conta_id?: string | null
          criado_em?: string | null
          id?: string
          pauta_id?: string | null
          status?: string | null
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "artes_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artes_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas_geradas"
            referencedColumns: ["id"]
          },
        ]
      }
      assinaturas: {
        Row: {
          atualizado_em: string
          cancelada_em: string | null
          comprador_email: string | null
          conta_id: string
          criado_em: string
          id: string
          iniciada_em: string
          kiwify_assinatura_id: string | null
          kiwify_pedido_id: string | null
          observacao: string | null
          origem: string
          plano_codigo: string
          proxima_renovacao: string | null
          situacao: string
          trial_fim: string | null
          valor_centavos: number
        }
        Insert: {
          atualizado_em?: string
          cancelada_em?: string | null
          comprador_email?: string | null
          conta_id: string
          criado_em?: string
          id?: string
          iniciada_em?: string
          kiwify_assinatura_id?: string | null
          kiwify_pedido_id?: string | null
          observacao?: string | null
          origem?: string
          plano_codigo: string
          proxima_renovacao?: string | null
          situacao?: string
          trial_fim?: string | null
          valor_centavos?: number
        }
        Update: {
          atualizado_em?: string
          cancelada_em?: string | null
          comprador_email?: string | null
          conta_id?: string
          criado_em?: string
          id?: string
          iniciada_em?: string
          kiwify_assinatura_id?: string | null
          kiwify_pedido_id?: string | null
          observacao?: string | null
          origem?: string
          plano_codigo?: string
          proxima_renovacao?: string | null
          situacao?: string
          trial_fim?: string | null
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: true
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_plano_codigo_fkey"
            columns: ["plano_codigo"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["codigo"]
          },
        ]
      }
      carrosseis: {
        Row: {
          atualizado_em: string
          conta_id: string | null
          copy: Json | null
          criado_em: string
          erro: string | null
          id: string
          pauta_id: string | null
          perfil_id: string | null
          status: string
          visual: Json | null
        }
        Insert: {
          atualizado_em?: string
          conta_id?: string | null
          copy?: Json | null
          criado_em?: string
          erro?: string | null
          id?: string
          pauta_id?: string | null
          perfil_id?: string | null
          status?: string
          visual?: Json | null
        }
        Update: {
          atualizado_em?: string
          conta_id?: string | null
          copy?: Json | null
          criado_em?: string
          erro?: string | null
          id?: string
          pauta_id?: string | null
          perfil_id?: string | null
          status?: string
          visual?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "carrosseis_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrosseis_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas_geradas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrosseis_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      conta_membros: {
        Row: {
          conta_id: string
          criado_em: string
          id: string
          papel: string
          quer_notificacoes: boolean
          user_id: string
        }
        Insert: {
          conta_id: string
          criado_em?: string
          id?: string
          papel?: string
          quer_notificacoes?: boolean
          user_id: string
        }
        Update: {
          conta_id?: string
          criado_em?: string
          id?: string
          papel?: string
          quer_notificacoes?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conta_membros_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas: {
        Row: {
          ciclo_inicio: string
          criado_em: string
          id: string
          nome: string
          plano_codigo: string
          status: string
        }
        Insert: {
          ciclo_inicio?: string
          criado_em?: string
          id?: string
          nome: string
          plano_codigo?: string
          status?: string
        }
        Update: {
          ciclo_inicio?: string
          criado_em?: string
          id?: string
          nome?: string
          plano_codigo?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_plano_codigo_fkey"
            columns: ["plano_codigo"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["codigo"]
          },
        ]
      }
      conteudos_curados: {
        Row: {
          aprovacao_humana: string
          capturado_em: string | null
          comentarios: number | null
          conta_id: string | null
          decidido_em: string | null
          formato: string | null
          gancho: string | null
          id: string
          likes: number | null
          perfil_referencia_id: string | null
          postado_em: string | null
          score_curadoria: number | null
          tema: string | null
          texto_original: string | null
          transcricao: string | null
          url: string | null
          views: number | null
        }
        Insert: {
          aprovacao_humana?: string
          capturado_em?: string | null
          comentarios?: number | null
          conta_id?: string | null
          decidido_em?: string | null
          formato?: string | null
          gancho?: string | null
          id?: string
          likes?: number | null
          perfil_referencia_id?: string | null
          postado_em?: string | null
          score_curadoria?: number | null
          tema?: string | null
          texto_original?: string | null
          transcricao?: string | null
          url?: string | null
          views?: number | null
        }
        Update: {
          aprovacao_humana?: string
          capturado_em?: string | null
          comentarios?: number | null
          conta_id?: string | null
          decidido_em?: string | null
          formato?: string | null
          gancho?: string | null
          id?: string
          likes?: number | null
          perfil_referencia_id?: string | null
          postado_em?: string | null
          score_curadoria?: number | null
          tema?: string | null
          texto_original?: string | null
          transcricao?: string | null
          url?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conteudos_curados_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteudos_curados_perfil_referencia_id_fkey"
            columns: ["perfil_referencia_id"]
            isOneToOne: false
            referencedRelation: "perfis_referencia"
            referencedColumns: ["id"]
          },
        ]
      }
      custo_eventos: {
        Row: {
          agente: string
          conta_id: string | null
          criado_em: string
          id: string
          itens: number
          modelo: string | null
          perfil_id: string | null
          tipo: string
          tokens_entrada: number
          tokens_saida: number
        }
        Insert: {
          agente: string
          conta_id?: string | null
          criado_em?: string
          id?: string
          itens?: number
          modelo?: string | null
          perfil_id?: string | null
          tipo: string
          tokens_entrada?: number
          tokens_saida?: number
        }
        Update: {
          agente?: string
          conta_id?: string | null
          criado_em?: string
          id?: string
          itens?: number
          modelo?: string | null
          perfil_id?: string | null
          tipo?: string
          tokens_entrada?: number
          tokens_saida?: number
        }
        Relationships: [
          {
            foreignKeyName: "custo_eventos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_eventos_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      custo_precos: {
        Row: {
          atualizado_em: string
          chave: string
          custo_entrada_mi_centavos: number
          custo_execucao_centavos: number
          custo_saida_mi_centavos: number
          rotulo: string
          tipo: string
        }
        Insert: {
          atualizado_em?: string
          chave: string
          custo_entrada_mi_centavos?: number
          custo_execucao_centavos?: number
          custo_saida_mi_centavos?: number
          rotulo: string
          tipo?: string
        }
        Update: {
          atualizado_em?: string
          chave?: string
          custo_entrada_mi_centavos?: number
          custo_execucao_centavos?: number
          custo_saida_mi_centavos?: number
          rotulo?: string
          tipo?: string
        }
        Relationships: []
      }
      decisoes_aprovacao: {
        Row: {
          comentario_livre: string | null
          conta_id: string | null
          criado_em: string | null
          decisao: string | null
          id: string
          item_id: string
          item_tipo: string | null
          motivo_categoria: string | null
          perfil_id: string | null
        }
        Insert: {
          comentario_livre?: string | null
          conta_id?: string | null
          criado_em?: string | null
          decisao?: string | null
          id?: string
          item_id: string
          item_tipo?: string | null
          motivo_categoria?: string | null
          perfil_id?: string | null
        }
        Update: {
          comentario_livre?: string | null
          conta_id?: string | null
          criado_em?: string | null
          decisao?: string | null
          id?: string
          item_id?: string
          item_tipo?: string | null
          motivo_categoria?: string | null
          perfil_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisoes_aprovacao_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisoes_aprovacao_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      dna_relatorios: {
        Row: {
          conta_id: string
          conteudo: Json
          gerado_em: string
          id: string
          modelo: string | null
          perfil_id: string | null
          versao: number
        }
        Insert: {
          conta_id: string
          conteudo: Json
          gerado_em?: string
          id?: string
          modelo?: string | null
          perfil_id?: string | null
          versao?: number
        }
        Update: {
          conta_id?: string
          conteudo?: Json
          gerado_em?: string
          id?: string
          modelo?: string | null
          perfil_id?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "dna_relatorios_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dna_relatorios_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      kiwify_eventos: {
        Row: {
          assinatura_externa_id: string | null
          comprador_email: string | null
          conta_id: string | null
          criado_em: string
          erro: string | null
          evento: string
          id: string
          payload: Json
          pedido_id: string | null
          plano_codigo: string | null
          processado: boolean
          processado_em: string | null
          valor_centavos: number | null
        }
        Insert: {
          assinatura_externa_id?: string | null
          comprador_email?: string | null
          conta_id?: string | null
          criado_em?: string
          erro?: string | null
          evento: string
          id?: string
          payload?: Json
          pedido_id?: string | null
          plano_codigo?: string | null
          processado?: boolean
          processado_em?: string | null
          valor_centavos?: number | null
        }
        Update: {
          assinatura_externa_id?: string | null
          comprador_email?: string | null
          conta_id?: string | null
          criado_em?: string
          erro?: string | null
          evento?: string
          id?: string
          payload?: Json
          pedido_id?: string | null
          plano_codigo?: string | null
          processado?: boolean
          processado_em?: string | null
          valor_centavos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kiwify_eventos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
        ]
      }
      oferta_leads: {
        Row: {
          atualizado_em: string
          comprou_em: string | null
          conta_criada_em: string | null
          conta_id: string | null
          criado_em: string
          email: string | null
          id: string
          importado_em: string | null
          ip_hash: string | null
          nome: string | null
          origem: Json
          pedido_id: string | null
          relatorio: Json | null
          relatorio_gerado_em: string | null
          relatorio_origem: string | null
          respostas: Json
          senha_definida_em: string | null
          token: string
        }
        Insert: {
          atualizado_em?: string
          comprou_em?: string | null
          conta_criada_em?: string | null
          conta_id?: string | null
          criado_em?: string
          email?: string | null
          id: string
          importado_em?: string | null
          ip_hash?: string | null
          nome?: string | null
          origem?: Json
          pedido_id?: string | null
          relatorio?: Json | null
          relatorio_gerado_em?: string | null
          relatorio_origem?: string | null
          respostas?: Json
          senha_definida_em?: string | null
          token: string
        }
        Update: {
          atualizado_em?: string
          comprou_em?: string | null
          conta_criada_em?: string | null
          conta_id?: string | null
          criado_em?: string
          email?: string | null
          id?: string
          importado_em?: string | null
          ip_hash?: string | null
          nome?: string | null
          origem?: Json
          pedido_id?: string | null
          relatorio?: Json | null
          relatorio_gerado_em?: string | null
          relatorio_origem?: string | null
          respostas?: Json
          senha_definida_em?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "oferta_leads_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_respostas: {
        Row: {
          atualizado_em: string
          concluido_em: string | null
          conta_id: string
          criado_em: string
          id: string
          passo_atual: number
          perfil_id: string | null
          respostas: Json
        }
        Insert: {
          atualizado_em?: string
          concluido_em?: string | null
          conta_id: string
          criado_em?: string
          id?: string
          passo_atual?: number
          perfil_id?: string | null
          respostas?: Json
        }
        Update: {
          atualizado_em?: string
          concluido_em?: string | null
          conta_id?: string
          criado_em?: string
          id?: string
          passo_atual?: number
          perfil_id?: string | null
          respostas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_respostas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: true
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_respostas_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      pautas_geradas: {
        Row: {
          angulo: string | null
          conta_id: string | null
          criado_em: string | null
          formato_sugerido: string | null
          id: string
          origem_curadoria_id: string | null
          perfil_id: string | null
          status: string | null
          tema: string | null
        }
        Insert: {
          angulo?: string | null
          conta_id?: string | null
          criado_em?: string | null
          formato_sugerido?: string | null
          id?: string
          origem_curadoria_id?: string | null
          perfil_id?: string | null
          status?: string | null
          tema?: string | null
        }
        Update: {
          angulo?: string | null
          conta_id?: string | null
          criado_em?: string | null
          formato_sugerido?: string | null
          id?: string
          origem_curadoria_id?: string | null
          perfil_id?: string | null
          status?: string | null
          tema?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pautas_geradas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_geradas_origem_curadoria_id_fkey"
            columns: ["origem_curadoria_id"]
            isOneToOne: false
            referencedRelation: "conteudos_curados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pautas_geradas_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          ativo: boolean | null
          conta_id: string | null
          criado_em: string | null
          cta_padrao: string | null
          diretrizes: Json | null
          foco_curadoria: string
          id: string
          identidade_visual: Json | null
          nome: string
          ritmo_dias: number[]
          ritmo_fuso: string
          ritmo_hora: string
          template_carrossel: Json
          tipo: string
          tom_de_voz: string | null
        }
        Insert: {
          ativo?: boolean | null
          conta_id?: string | null
          criado_em?: string | null
          cta_padrao?: string | null
          diretrizes?: Json | null
          foco_curadoria?: string
          id?: string
          identidade_visual?: Json | null
          nome: string
          ritmo_dias?: number[]
          ritmo_fuso?: string
          ritmo_hora?: string
          template_carrossel?: Json
          tipo: string
          tom_de_voz?: string | null
        }
        Update: {
          ativo?: boolean | null
          conta_id?: string | null
          criado_em?: string | null
          cta_padrao?: string | null
          diretrizes?: Json | null
          foco_curadoria?: string
          id?: string
          identidade_visual?: Json | null
          nome?: string
          ritmo_dias?: number[]
          ritmo_fuso?: string
          ritmo_hora?: string
          template_carrossel?: Json
          tipo?: string
          tom_de_voz?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfis_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_referencia: {
        Row: {
          ativo: boolean | null
          conta_id: string | null
          criado_em: string | null
          foco_curadoria: string | null
          handle: string
          id: string
          nicho: string | null
          perfil_id_relacionado: string | null
        }
        Insert: {
          ativo?: boolean | null
          conta_id?: string | null
          criado_em?: string | null
          foco_curadoria?: string | null
          handle: string
          id?: string
          nicho?: string | null
          perfil_id_relacionado?: string | null
        }
        Update: {
          ativo?: boolean | null
          conta_id?: string | null
          criado_em?: string | null
          foco_curadoria?: string | null
          handle?: string
          id?: string
          nicho?: string | null
          perfil_id_relacionado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfis_referencia_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfis_referencia_perfil_id_relacionado_fkey"
            columns: ["perfil_id_relacionado"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean
          beneficios: Json
          checkout_url: string | null
          codigo: string
          criado_em: string
          descricao: string | null
          kiwify_oferta_id: string | null
          kiwify_produto_id: string | null
          limite_carrosseis_mes: number
          limite_curadorias_mes: number
          limite_perfis: number
          limite_referencias: number
          limite_roteiros_mes: number
          moeda: string
          nome: string
          ordem: number
          preco_anual_centavos: number
          preco_mensal_centavos: number
          publico: boolean
          recomendado: boolean
          trial_dias: number
        }
        Insert: {
          ativo?: boolean
          beneficios?: Json
          checkout_url?: string | null
          codigo: string
          criado_em?: string
          descricao?: string | null
          kiwify_oferta_id?: string | null
          kiwify_produto_id?: string | null
          limite_carrosseis_mes?: number
          limite_curadorias_mes?: number
          limite_perfis?: number
          limite_referencias?: number
          limite_roteiros_mes?: number
          moeda?: string
          nome: string
          ordem?: number
          preco_anual_centavos?: number
          preco_mensal_centavos?: number
          publico?: boolean
          recomendado?: boolean
          trial_dias?: number
        }
        Update: {
          ativo?: boolean
          beneficios?: Json
          checkout_url?: string | null
          codigo?: string
          criado_em?: string
          descricao?: string | null
          kiwify_oferta_id?: string | null
          kiwify_produto_id?: string | null
          limite_carrosseis_mes?: number
          limite_curadorias_mes?: number
          limite_perfis?: number
          limite_referencias?: number
          limite_roteiros_mes?: number
          moeda?: string
          nome?: string
          ordem?: number
          preco_anual_centavos?: number
          preco_mensal_centavos?: number
          publico?: boolean
          recomendado?: boolean
          trial_dias?: number
        }
        Relationships: []
      }
      publicacoes: {
        Row: {
          conta_id: string | null
          criado_em: string | null
          id: string
          pauta_id: string | null
          perfil_id: string | null
          postado_em: string | null
          status: string | null
        }
        Insert: {
          conta_id?: string | null
          criado_em?: string | null
          id?: string
          pauta_id?: string | null
          perfil_id?: string | null
          postado_em?: string | null
          status?: string | null
        }
        Update: {
          conta_id?: string | null
          criado_em?: string | null
          id?: string
          pauta_id?: string | null
          perfil_id?: string | null
          postado_em?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publicacoes_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicacoes_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas_geradas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicacoes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notificacoes_pendentes: {
        Row: {
          conta_id: string
          contagem: number
          enviado_em: string | null
          id: string
          perfil_id: string
          primeiro_evento_em: string
          tipo: string
          ultimo_evento_em: string
        }
        Insert: {
          conta_id: string
          contagem?: number
          enviado_em?: string | null
          id?: string
          perfil_id: string
          primeiro_evento_em?: string
          tipo: string
          ultimo_evento_em?: string
        }
        Update: {
          conta_id?: string
          contagem?: number
          enviado_em?: string | null
          id?: string
          perfil_id?: string
          primeiro_evento_em?: string
          tipo?: string
          ultimo_evento_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notificacoes_pendentes_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_notificacoes_pendentes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          criado_em: string
          endpoint: string
          id: string
          p256dh: string
          ultimo_uso_em: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          criado_em?: string
          endpoint: string
          id?: string
          p256dh: string
          ultimo_uso_em?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          criado_em?: string
          endpoint?: string
          id?: string
          p256dh?: string
          ultimo_uso_em?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referencias_sugeridas: {
        Row: {
          area_atuacao: string
          ativo: boolean
          criado_em: string
          descricao: string | null
          handle: string
          id: string
          ordem: number
        }
        Insert: {
          area_atuacao: string
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          handle: string
          id?: string
          ordem?: number
        }
        Update: {
          area_atuacao?: string
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          handle?: string
          id?: string
          ordem?: number
        }
        Relationships: []
      }
      roteiros: {
        Row: {
          conta_id: string | null
          conteudo: Json | null
          criado_em: string | null
          id: string
          pauta_id: string | null
          status: string | null
          versao: number | null
        }
        Insert: {
          conta_id?: string | null
          conteudo?: Json | null
          criado_em?: string | null
          id?: string
          pauta_id?: string | null
          status?: string | null
          versao?: number | null
        }
        Update: {
          conta_id?: string | null
          conteudo?: Json | null
          criado_em?: string | null
          id?: string
          pauta_id?: string | null
          status?: string | null
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "roteiros_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roteiros_pauta_id_fkey"
            columns: ["pauta_id"]
            isOneToOne: false
            referencedRelation: "pautas_geradas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          criado_em: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      uso_mensal: {
        Row: {
          atualizado_em: string
          ciclo: string
          conta_id: string
          id: string
          quantidade: number
          tipo: string
        }
        Insert: {
          atualizado_em?: string
          ciclo: string
          conta_id: string
          id?: string
          quantidade?: number
          tipo: string
        }
        Update: {
          atualizado_em?: string
          ciclo?: string
          conta_id?: string
          id?: string
          quantidade?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "uso_mensal_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_conta_economia_mensal: {
        Row: {
          ciclo: string | null
          conta_id: string | null
          custo_ia_centavos: number | null
          custo_medio_geracao_centavos: number | null
          custo_scraping_centavos: number | null
          custo_total_centavos: number | null
          geracoes: number | null
          geracoes_estimadas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "custo_eventos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_custo_eventos: {
        Row: {
          agente: string | null
          ciclo: string | null
          conta_id: string | null
          criado_em: string | null
          custo_centavos: number | null
          estimado: boolean | null
          id: string | null
          itens: number | null
          modelo: string | null
          perfil_id: string | null
          tipo: string | null
          tokens_entrada: number | null
          tokens_saida: number | null
        }
        Relationships: [
          {
            foreignKeyName: "custo_eventos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custo_eventos_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_custo_medio_tipo: {
        Row: {
          custo_max_centavos: number | null
          custo_medio_centavos: number | null
          eventos: number | null
          tipo: string | null
        }
        Relationships: []
      }
      vw_plataforma_mensal: {
        Row: {
          ciclo: string | null
          contas_ativas: number | null
          custo_ia_centavos: number | null
          custo_scraping_centavos: number | null
          custo_total_centavos: number | null
          geracoes: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      agent_function_url: { Args: { nome: string }; Returns: string }
      agent_internal_headers: { Args: never; Returns: Json }
      agent_secret: { Args: { nome: string }; Returns: string }
      contas_do_usuario: { Args: { _user_id: string }; Returns: string[] }
      despachar_notificacoes_pendentes: {
        Args: { p_forcar?: boolean }
        Returns: undefined
      }
      enfileirar_cobranca_ritmo: { Args: never; Returns: undefined }
      enfileirar_notificacao_push: {
        Args: { p_conta_id: string; p_perfil_id: string; p_tipo: string }
        Returns: undefined
      }
      expirar_trials: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      iniciar_conta_trial: {
        Args: { _nome: string; _plano?: string; _user_id: string }
        Returns: string
      }
      is_conta_membro: { Args: { _conta_id: string }; Returns: boolean }
      is_conta_owner: { Args: { _conta_id: string }; Returns: boolean }
      limite_disponivel: {
        Args: { _conta_id: string; _tipo: string }
        Returns: Json
      }
      minha_conta: { Args: never; Returns: string }
      promote_next_pauta: { Args: never; Returns: undefined }
      registrar_uso: {
        Args: { _conta_id: string; _qtd?: number; _tipo: string }
        Returns: undefined
      }
      revisar_next_pauta_pronta: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "member"],
    },
  },
} as const
