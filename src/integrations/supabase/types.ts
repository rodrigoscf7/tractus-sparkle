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
          criado_em: string | null
          id: string
          pauta_id: string | null
          status: string | null
          versao: number | null
        }
        Insert: {
          briefing?: Json | null
          criado_em?: string | null
          id?: string
          pauta_id?: string | null
          status?: string | null
          versao?: number | null
        }
        Update: {
          briefing?: Json | null
          criado_em?: string | null
          id?: string
          pauta_id?: string | null
          status?: string | null
          versao?: number | null
        }
        Relationships: [
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
      conteudos_curados: {
        Row: {
          aprovacao_humana: string
          capturado_em: string | null
          comentarios: number | null
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
          criado_em: string | null
          diretrizes: Json | null
          id: string
          identidade_visual: Json | null
          nome: string
          template_carrossel: Json
          tipo: string
          tom_de_voz: string | null
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          diretrizes?: Json | null
          id?: string
          identidade_visual?: Json | null
          nome: string
          template_carrossel?: Json
          tipo: string
          tom_de_voz?: string | null
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          diretrizes?: Json | null
          id?: string
          identidade_visual?: Json | null
          nome?: string
          template_carrossel?: Json
          tipo?: string
          tom_de_voz?: string | null
        }
        Relationships: []
      }
      perfis_referencia: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          handle: string
          id: string
          nicho: string | null
          perfil_id_relacionado: string | null
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          handle: string
          id?: string
          nicho?: string | null
          perfil_id_relacionado?: string | null
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          handle?: string
          id?: string
          nicho?: string | null
          perfil_id_relacionado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfis_referencia_perfil_id_relacionado_fkey"
            columns: ["perfil_id_relacionado"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      publicacoes: {
        Row: {
          criado_em: string | null
          id: string
          pauta_id: string | null
          perfil_id: string | null
          postado_em: string | null
          status: string | null
        }
        Insert: {
          criado_em?: string | null
          id?: string
          pauta_id?: string | null
          perfil_id?: string | null
          postado_em?: string | null
          status?: string | null
        }
        Update: {
          criado_em?: string | null
          id?: string
          pauta_id?: string | null
          perfil_id?: string | null
          postado_em?: string | null
          status?: string | null
        }
        Relationships: [
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
          conteudo: Json | null
          criado_em: string | null
          id: string
          pauta_id: string | null
          status: string | null
          versao: number | null
        }
        Insert: {
          conteudo?: Json | null
          criado_em?: string | null
          id?: string
          pauta_id?: string | null
          status?: string | null
          versao?: number | null
        }
        Update: {
          conteudo?: Json | null
          criado_em?: string | null
          id?: string
          pauta_id?: string | null
          status?: string | null
          versao?: number | null
        }
        Relationships: [
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      agent_internal_headers: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      promote_next_pauta: { Args: never; Returns: undefined }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
