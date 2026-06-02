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
      app_config: {
        Row: {
          atualizado_em: string
          config_json: Json
          id: number
        }
        Insert: {
          atualizado_em?: string
          config_json?: Json
          id?: number
        }
        Update: {
          atualizado_em?: string
          config_json?: Json
          id?: number
        }
        Relationships: []
      }
      clientes: {
        Row: {
          atualizado_em: string
          cidade: string | null
          codigo: string
          corridas: number
          criado_em: string
          endereco: string | null
          indicacao: string | null
          nome: string
          observacoes: string | null
          telefone: string | null
        }
        Insert: {
          atualizado_em?: string
          cidade?: string | null
          codigo: string
          corridas?: number
          criado_em?: string
          endereco?: string | null
          indicacao?: string | null
          nome: string
          observacoes?: string | null
          telefone?: string | null
        }
        Update: {
          atualizado_em?: string
          cidade?: string | null
          codigo?: string
          corridas?: number
          criado_em?: string
          endereco?: string | null
          indicacao?: string | null
          nome?: string
          observacoes?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      corrida_ofertas: {
        Row: {
          corrida_id: number
          criado_em: string
          id: number
          motorista_codigo: string
          status: string
        }
        Insert: {
          corrida_id: number
          criado_em?: string
          id?: number
          motorista_codigo: string
          status?: string
        }
        Update: {
          corrida_id?: number
          criado_em?: string
          id?: number
          motorista_codigo?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrida_ofertas_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrida_ofertas_motorista_codigo_fkey"
            columns: ["motorista_codigo"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["codigo"]
          },
        ]
      }
      corridas: {
        Row: {
          atualizado_em: string
          cliente: string | null
          cliente_codigo: string | null
          criado_em: string
          destino: string | null
          destino_lat: number | null
          destino_lng: number | null
          distancia_km: number | null
          finalizada_em: string | null
          id: number
          motorista: string | null
          motorista_codigo: string | null
          observacoes: string | null
          origem: string
          origem_lat: number | null
          origem_lng: number | null
          pagamento: Database["public"]["Enums"]["tipo_pagamento"] | null
          status: Database["public"]["Enums"]["status_corrida"]
          telefone_cliente: string | null
          tipo: string | null
          valor_final: number
        }
        Insert: {
          atualizado_em?: string
          cliente?: string | null
          cliente_codigo?: string | null
          criado_em?: string
          destino?: string | null
          destino_lat?: number | null
          destino_lng?: number | null
          distancia_km?: number | null
          finalizada_em?: string | null
          id?: number
          motorista?: string | null
          motorista_codigo?: string | null
          observacoes?: string | null
          origem: string
          origem_lat?: number | null
          origem_lng?: number | null
          pagamento?: Database["public"]["Enums"]["tipo_pagamento"] | null
          status?: Database["public"]["Enums"]["status_corrida"]
          telefone_cliente?: string | null
          tipo?: string | null
          valor_final?: number
        }
        Update: {
          atualizado_em?: string
          cliente?: string | null
          cliente_codigo?: string | null
          criado_em?: string
          destino?: string | null
          destino_lat?: number | null
          destino_lng?: number | null
          distancia_km?: number | null
          finalizada_em?: string | null
          id?: number
          motorista?: string | null
          motorista_codigo?: string | null
          observacoes?: string | null
          origem?: string
          origem_lat?: number | null
          origem_lng?: number | null
          pagamento?: Database["public"]["Enums"]["tipo_pagamento"] | null
          status?: Database["public"]["Enums"]["status_corrida"]
          telefone_cliente?: string | null
          tipo?: string | null
          valor_final?: number
        }
        Relationships: [
          {
            foreignKeyName: "corridas_cliente_codigo_fkey"
            columns: ["cliente_codigo"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "corridas_motorista_codigo_fkey"
            columns: ["motorista_codigo"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["codigo"]
          },
        ]
      }
      financeiro: {
        Row: {
          data: string
          dia_op: string | null
          id: number
          motorista: string | null
          motorista_codigo: string
          operador: string | null
          tipo: string
          valor: number
        }
        Insert: {
          data?: string
          dia_op?: string | null
          id?: number
          motorista?: string | null
          motorista_codigo: string
          operador?: string | null
          tipo?: string
          valor: number
        }
        Update: {
          data?: string
          dia_op?: string | null
          id?: number
          motorista?: string | null
          motorista_codigo?: string
          operador?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_motorista_codigo_fkey"
            columns: ["motorista_codigo"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["codigo"]
          },
        ]
      }
      motorista_auth: {
        Row: {
          atualizado_em: string
          criado_em: string
          device_id: string | null
          device_nome: string | null
          motivo_bloqueio: string | null
          motorista_codigo: string
          senha_hash: string
          senha_plain: string | null
          status: Database["public"]["Enums"]["status_motorista_auth"]
          ultimo_acesso: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          device_id?: string | null
          device_nome?: string | null
          motivo_bloqueio?: string | null
          motorista_codigo: string
          senha_hash: string
          senha_plain?: string | null
          status?: Database["public"]["Enums"]["status_motorista_auth"]
          ultimo_acesso?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          device_id?: string | null
          device_nome?: string | null
          motivo_bloqueio?: string | null
          motorista_codigo?: string
          senha_hash?: string
          senha_plain?: string | null
          status?: Database["public"]["Enums"]["status_motorista_auth"]
          ultimo_acesso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motorista_auth_motorista_codigo_fkey"
            columns: ["motorista_codigo"]
            isOneToOne: true
            referencedRelation: "motoristas"
            referencedColumns: ["codigo"]
          },
        ]
      }
      motorista_gps: {
        Row: {
          criado_em: string
          id: number
          lat: number
          lng: number
          motorista_codigo: string
          velocidade: number | null
        }
        Insert: {
          criado_em?: string
          id?: number
          lat: number
          lng: number
          motorista_codigo: string
          velocidade?: number | null
        }
        Update: {
          criado_em?: string
          id?: number
          lat?: number
          lng?: number
          motorista_codigo?: string
          velocidade?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "motorista_gps_motorista_codigo_fkey"
            columns: ["motorista_codigo"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["codigo"]
          },
        ]
      }
      motorista_sessoes: {
        Row: {
          criado_em: string
          device_id: string | null
          id: string
          motorista_codigo: string
          status: string
          token: string
        }
        Insert: {
          criado_em?: string
          device_id?: string | null
          id?: string
          motorista_codigo: string
          status?: string
          token: string
        }
        Update: {
          criado_em?: string
          device_id?: string | null
          id?: string
          motorista_codigo?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "motorista_sessoes_motorista_codigo_fkey"
            columns: ["motorista_codigo"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["codigo"]
          },
        ]
      }
      motoristas: {
        Row: {
          atualizado_em: string
          cidade: string | null
          cnh: string | null
          codigo: string
          cor: string | null
          corridas: number
          cpf: string | null
          creditos_diaria: number
          criado_em: string
          doc_cnh: string | null
          doc_endereco: string | null
          doc_veiculo: string | null
          endereco: string | null
          foto: string | null
          foto_moto: string | null
          moto: string | null
          nome: string
          nome_familiar: string | null
          placa: string | null
          status: Database["public"]["Enums"]["status_motorista"]
          telefone: string | null
          telefone_familiar: string | null
        }
        Insert: {
          atualizado_em?: string
          cidade?: string | null
          cnh?: string | null
          codigo: string
          cor?: string | null
          corridas?: number
          cpf?: string | null
          creditos_diaria?: number
          criado_em?: string
          doc_cnh?: string | null
          doc_endereco?: string | null
          doc_veiculo?: string | null
          endereco?: string | null
          foto?: string | null
          foto_moto?: string | null
          moto?: string | null
          nome: string
          nome_familiar?: string | null
          placa?: string | null
          status?: Database["public"]["Enums"]["status_motorista"]
          telefone?: string | null
          telefone_familiar?: string | null
        }
        Update: {
          atualizado_em?: string
          cidade?: string | null
          cnh?: string | null
          codigo?: string
          cor?: string | null
          corridas?: number
          cpf?: string | null
          creditos_diaria?: number
          criado_em?: string
          doc_cnh?: string | null
          doc_endereco?: string | null
          doc_veiculo?: string | null
          endereco?: string | null
          foto?: string | null
          foto_moto?: string | null
          moto?: string | null
          nome?: string
          nome_familiar?: string | null
          placa?: string | null
          status?: Database["public"]["Enums"]["status_motorista"]
          telefone?: string | null
          telefone_familiar?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          criado_em: string
          id: string
          motorista_codigo: string
          subscription_json: Json
        }
        Insert: {
          criado_em?: string
          id?: string
          motorista_codigo: string
          subscription_json: Json
        }
        Update: {
          criado_em?: string
          id?: string
          motorista_codigo?: string
          subscription_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_motorista_codigo_fkey"
            columns: ["motorista_codigo"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["codigo"]
          },
        ]
      }
      tarifas: {
        Row: {
          ativa: boolean
          bandeirada: number
          criado_em: string
          id: number
          minimo: number
          nome: string
          por_km: number
        }
        Insert: {
          ativa?: boolean
          bandeirada?: number
          criado_em?: string
          id?: number
          minimo?: number
          nome: string
          por_km?: number
        }
        Update: {
          ativa?: boolean
          bandeirada?: number
          criado_em?: string
          id?: number
          minimo?: number
          nome?: string
          por_km?: number
        }
        Relationships: []
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
      dia_operacional: { Args: { _ts?: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_operador: { Args: { _user_id: string }; Returns: boolean }
      preview_proximo_codigo_cliente: { Args: never; Returns: string }
      preview_proximo_codigo_motorista: { Args: never; Returns: string }
      proximo_codigo_cliente: { Args: never; Returns: string }
      proximo_codigo_motorista: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "operador"
      status_corrida:
        | "Pendente"
        | "Ofertada"
        | "Aceita"
        | "A caminho"
        | "Chegou"
        | "Em viagem"
        | "Finalizada"
        | "Cancelada"
      status_motorista: "Offline" | "Online" | "Em corrida" | "Bloqueado"
      status_motorista_auth: "Ativo" | "Bloqueado"
      tipo_pagamento: "Dinheiro" | "Pix" | "Cartão" | "Maquininha" | "Conta"
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
      app_role: ["admin", "operador"],
      status_corrida: [
        "Pendente",
        "Ofertada",
        "Aceita",
        "A caminho",
        "Chegou",
        "Em viagem",
        "Finalizada",
        "Cancelada",
      ],
      status_motorista: ["Offline", "Online", "Em corrida", "Bloqueado"],
      status_motorista_auth: ["Ativo", "Bloqueado"],
      tipo_pagamento: ["Dinheiro", "Pix", "Cartão", "Maquininha", "Conta"],
    },
  },
} as const
