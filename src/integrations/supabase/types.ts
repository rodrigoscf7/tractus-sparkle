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
  public: {
    Tables: {
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
          user_id: string
        }
        Insert: {
          conta_id: string
          criado_em?: string
          id?: string
          papel?: string
          user_id: string
        }
        Update: {
          conta_id?: string
          criado_em?: string
          id?: string
          papel?: string
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
          codigo: string
          criado_em: string
          limite_carrosseis_mes: number
          limite_curadorias_mes: number
          limite_perfis: number
          limite_referencias: number
          limite_roteiros_mes: number
          nome: string
          ordem: number
          preco_mensal_centavos: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          criado_em?: string
          limite_carrosseis_mes?: number
          limite_curadorias_mes?: number
          limite_perfis?: number
          limite_referencias?: number
          limite_roteiros_mes?: number
          nome: string
          ordem?: number
          preco_mensal_centavos?: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          criado_em?: string
          limite_carrosseis_mes?: number
          limite_curadorias_mes?: number
          limite_perfis?: number
          limite_referencias?: number
          limite_roteiros_mes?: number
          nome?: string
          ordem?: number
          preco_mensal_centavos?: number
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
      [_ in never]: never
    }
    Functions: {
      agent_internal_headers: { Args: never; Returns: Json }
      contas_do_usuario: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
  public: {
    Enums: {
      app_role: ["admin", "member"],
    },
  },
} as const
