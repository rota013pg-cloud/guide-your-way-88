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
      chat_cliente: {
        Row: {
          autor: string
          autor_nome: string | null
          cliente_codigo: string
          criado_em: string
          id: number
          lido: boolean
          texto: string
        }
        Insert: {
          autor: string
          autor_nome?: string | null
          cliente_codigo: string
          criado_em?: string
          id?: number
          lido?: boolean
          texto: string
        }
        Update: {
          autor?: string
          autor_nome?: string | null
          cliente_codigo?: string
          criado_em?: string
          id?: number
          lido?: boolean
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_cliente_cliente_codigo_fkey"
            columns: ["cliente_codigo"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["codigo"]
          },
        ]
      }
      chat_motorista: {
        Row: {
          autor: string
          autor_nome: string | null
          criado_em: string
          id: number
          lido: boolean
          motorista_codigo: string
          texto: string
        }
        Insert: {
          autor: string
          autor_nome?: string | null
          criado_em?: string
          id?: number
          lido?: boolean
          motorista_codigo: string
          texto: string
        }
        Update: {
          autor?: string
          autor_nome?: string | null
          criado_em?: string
          id?: number
          lido?: boolean
          motorista_codigo?: string
          texto?: string
        }
        Relationships: []
      }
      cliente_auth: {
        Row: {
          atualizado_em: string
          cliente_codigo: string
          criado_em: string
          email_lower: string
          reset_token: string | null
          reset_token_expira_em: string | null
          senha_hash: string
          ultimo_acesso_em: string | null
        }
        Insert: {
          atualizado_em?: string
          cliente_codigo: string
          criado_em?: string
          email_lower: string
          reset_token?: string | null
          reset_token_expira_em?: string | null
          senha_hash: string
          ultimo_acesso_em?: string | null
        }
        Update: {
          atualizado_em?: string
          cliente_codigo?: string
          criado_em?: string
          email_lower?: string
          reset_token?: string | null
          reset_token_expira_em?: string | null
          senha_hash?: string
          ultimo_acesso_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_auth_cliente_codigo_fkey"
            columns: ["cliente_codigo"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["codigo"]
          },
        ]
      }
      cliente_sessoes: {
        Row: {
          cliente_codigo: string
          criado_em: string
          id: number
          ip: string | null
          status: string
          token: string
          ultima_atividade_em: string
          user_agent: string | null
        }
        Insert: {
          cliente_codigo: string
          criado_em?: string
          id?: number
          ip?: string | null
          status?: string
          token: string
          ultima_atividade_em?: string
          user_agent?: string | null
        }
        Update: {
          cliente_codigo?: string
          criado_em?: string
          id?: number
          ip?: string | null
          status?: string
          token?: string
          ultima_atividade_em?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_sessoes_cliente_codigo_fkey"
            columns: ["cliente_codigo"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["codigo"]
          },
        ]
      }
      clientes: {
        Row: {
          atualizado_em: string
          cidade: string | null
          codigo: string
          corridas: number
          cpf: string | null
          criado_em: string
          email: string | null
          endereco: string | null
          endereco_bairro: string | null
          endereco_cidade: string | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          indicacao: string | null
          nome: string
          observacoes: string | null
          telefone: string | null
          termos_aceitos_em: string | null
          termos_versao: string | null
        }
        Insert: {
          atualizado_em?: string
          cidade?: string | null
          codigo: string
          corridas?: number
          cpf?: string | null
          criado_em?: string
          email?: string | null
          endereco?: string | null
          endereco_bairro?: string | null
          endereco_cidade?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          indicacao?: string | null
          nome: string
          observacoes?: string | null
          telefone?: string | null
          termos_aceitos_em?: string | null
          termos_versao?: string | null
        }
        Update: {
          atualizado_em?: string
          cidade?: string | null
          codigo?: string
          corridas?: number
          cpf?: string | null
          criado_em?: string
          email?: string | null
          endereco?: string | null
          endereco_bairro?: string | null
          endereco_cidade?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          indicacao?: string | null
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          termos_aceitos_em?: string | null
          termos_versao?: string | null
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
      corrida_status_log: {
        Row: {
          corrida_id: number
          criado_em: string
          id: number
          motorista_codigo: string | null
          observacao: string | null
          status: string
        }
        Insert: {
          corrida_id: number
          criado_em?: string
          id?: number
          motorista_codigo?: string | null
          observacao?: string | null
          status: string
        }
        Update: {
          corrida_id?: number
          criado_em?: string
          id?: number
          motorista_codigo?: string | null
          observacao?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrida_status_log_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
        ]
      }
      corridas: {
        Row: {
          agendada_para: string | null
          aguardando_registro: boolean
          alerta_antes_min: number
          alerta_disparado: boolean
          atualizado_em: string
          avaliacao_comentario: string | null
          avaliacao_corrida: number | null
          avaliacao_motorista: number | null
          avaliada_em: string | null
          cliente: string | null
          cliente_codigo: string | null
          criado_em: string
          despacho: Database["public"]["Enums"]["despacho_corrida"]
          destino: string | null
          destino_lat: number | null
          destino_lng: number | null
          distancia_km: number | null
          eta_chegada_em: string | null
          eta_coleta_atualizado_em: string | null
          eta_coleta_segundos: number | null
          finalizada_em: string | null
          id: number
          modelo: Database["public"]["Enums"]["modelo_corrida"]
          motorista: string | null
          motorista_codigo: string | null
          motoristas_manuais: string[]
          observacoes: string | null
          origem: string
          origem_lat: number | null
          origem_lng: number | null
          pagamento: Database["public"]["Enums"]["tipo_pagamento"] | null
          paradas: Json
          passageiros: Json
          rodada_atual: number
          solicitacoes_especiais: string[]
          status: Database["public"]["Enums"]["status_corrida"]
          telefone_cliente: string | null
          tipo: string | null
          valor_final: number
          valor_paradas: number
        }
        Insert: {
          agendada_para?: string | null
          aguardando_registro?: boolean
          alerta_antes_min?: number
          alerta_disparado?: boolean
          atualizado_em?: string
          avaliacao_comentario?: string | null
          avaliacao_corrida?: number | null
          avaliacao_motorista?: number | null
          avaliada_em?: string | null
          cliente?: string | null
          cliente_codigo?: string | null
          criado_em?: string
          despacho?: Database["public"]["Enums"]["despacho_corrida"]
          destino?: string | null
          destino_lat?: number | null
          destino_lng?: number | null
          distancia_km?: number | null
          eta_chegada_em?: string | null
          eta_coleta_atualizado_em?: string | null
          eta_coleta_segundos?: number | null
          finalizada_em?: string | null
          id?: number
          modelo?: Database["public"]["Enums"]["modelo_corrida"]
          motorista?: string | null
          motorista_codigo?: string | null
          motoristas_manuais?: string[]
          observacoes?: string | null
          origem: string
          origem_lat?: number | null
          origem_lng?: number | null
          pagamento?: Database["public"]["Enums"]["tipo_pagamento"] | null
          paradas?: Json
          passageiros?: Json
          rodada_atual?: number
          solicitacoes_especiais?: string[]
          status?: Database["public"]["Enums"]["status_corrida"]
          telefone_cliente?: string | null
          tipo?: string | null
          valor_final?: number
          valor_paradas?: number
        }
        Update: {
          agendada_para?: string | null
          aguardando_registro?: boolean
          alerta_antes_min?: number
          alerta_disparado?: boolean
          atualizado_em?: string
          avaliacao_comentario?: string | null
          avaliacao_corrida?: number | null
          avaliacao_motorista?: number | null
          avaliada_em?: string | null
          cliente?: string | null
          cliente_codigo?: string | null
          criado_em?: string
          despacho?: Database["public"]["Enums"]["despacho_corrida"]
          destino?: string | null
          destino_lat?: number | null
          destino_lng?: number | null
          distancia_km?: number | null
          eta_chegada_em?: string | null
          eta_coleta_atualizado_em?: string | null
          eta_coleta_segundos?: number | null
          finalizada_em?: string | null
          id?: number
          modelo?: Database["public"]["Enums"]["modelo_corrida"]
          motorista?: string | null
          motorista_codigo?: string | null
          motoristas_manuais?: string[]
          observacoes?: string | null
          origem?: string
          origem_lat?: number | null
          origem_lng?: number | null
          pagamento?: Database["public"]["Enums"]["tipo_pagamento"] | null
          paradas?: Json
          passageiros?: Json
          rodada_atual?: number
          solicitacoes_especiais?: string[]
          status?: Database["public"]["Enums"]["status_corrida"]
          telefone_cliente?: string | null
          tipo?: string | null
          valor_final?: number
          valor_paradas?: number
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
      motorista_alertas: {
        Row: {
          atendido_em: string | null
          atendido_observacao: string | null
          atendido_por: string | null
          corrida_id: number | null
          criado_em: string
          id: number
          latitude: number | null
          longitude: number | null
          motorista_codigo: string
          observacao: string | null
          tipo: Database["public"]["Enums"]["tipo_alerta_motorista"]
        }
        Insert: {
          atendido_em?: string | null
          atendido_observacao?: string | null
          atendido_por?: string | null
          corrida_id?: number | null
          criado_em?: string
          id?: number
          latitude?: number | null
          longitude?: number | null
          motorista_codigo: string
          observacao?: string | null
          tipo: Database["public"]["Enums"]["tipo_alerta_motorista"]
        }
        Update: {
          atendido_em?: string | null
          atendido_observacao?: string | null
          atendido_por?: string | null
          corrida_id?: number | null
          criado_em?: string
          id?: number
          latitude?: number | null
          longitude?: number | null
          motorista_codigo?: string
          observacao?: string | null
          tipo?: Database["public"]["Enums"]["tipo_alerta_motorista"]
        }
        Relationships: [
          {
            foreignKeyName: "motorista_alertas_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
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
      motorista_cobranca: {
        Row: {
          atualizado_em: string
          comprovante_enviado_em: string | null
          comprovante_rejeicao_motivo: string | null
          comprovante_rejeitado_em: string | null
          comprovante_url: string | null
          criado_em: string
          dia_op: string
          disparou_aviso_em: string | null
          disparou_bloqueio_em: string | null
          faturamento_dia: number
          id: number
          liberado_em: string | null
          liberado_por: string | null
          motorista_codigo: string
          observacoes: string | null
          status: string
          valor_diaria: number
        }
        Insert: {
          atualizado_em?: string
          comprovante_enviado_em?: string | null
          comprovante_rejeicao_motivo?: string | null
          comprovante_rejeitado_em?: string | null
          comprovante_url?: string | null
          criado_em?: string
          dia_op: string
          disparou_aviso_em?: string | null
          disparou_bloqueio_em?: string | null
          faturamento_dia?: number
          id?: number
          liberado_em?: string | null
          liberado_por?: string | null
          motorista_codigo: string
          observacoes?: string | null
          status?: string
          valor_diaria?: number
        }
        Update: {
          atualizado_em?: string
          comprovante_enviado_em?: string | null
          comprovante_rejeicao_motivo?: string | null
          comprovante_rejeitado_em?: string | null
          comprovante_url?: string | null
          criado_em?: string
          dia_op?: string
          disparou_aviso_em?: string | null
          disparou_bloqueio_em?: string | null
          faturamento_dia?: number
          id?: number
          liberado_em?: string | null
          liberado_por?: string | null
          motorista_codigo?: string
          observacoes?: string | null
          status?: string
          valor_diaria?: number
        }
        Relationships: []
      }
      motorista_cobranca_lancamentos: {
        Row: {
          cobranca_id: number
          data: string
          dia_op: string | null
          financeiro_id: number | null
          id: number
          motorista_codigo: string
          observacoes: string | null
          operador: string | null
          valor: number
        }
        Insert: {
          cobranca_id: number
          data?: string
          dia_op?: string | null
          financeiro_id?: number | null
          id?: number
          motorista_codigo: string
          observacoes?: string | null
          operador?: string | null
          valor: number
        }
        Update: {
          cobranca_id?: number
          data?: string
          dia_op?: string | null
          financeiro_id?: number | null
          id?: number
          motorista_codigo?: string
          observacoes?: string | null
          operador?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "motorista_cobranca_lancamentos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "motorista_cobrancas_extras"
            referencedColumns: ["id"]
          },
        ]
      }
      motorista_cobrancas_extras: {
        Row: {
          atualizado_em: string
          categoria: Database["public"]["Enums"]["categoria_cobranca_extra"]
          criado_em: string
          descricao: string
          forma_cobranca: Database["public"]["Enums"]["forma_cobranca_extra"]
          id: number
          motorista_codigo: string
          observacoes: string | null
          operador: string | null
          quitada_em: string | null
          status: Database["public"]["Enums"]["status_cobranca_extra"]
          valor_parcela_dia: number
          valor_total: number
        }
        Insert: {
          atualizado_em?: string
          categoria?: Database["public"]["Enums"]["categoria_cobranca_extra"]
          criado_em?: string
          descricao: string
          forma_cobranca?: Database["public"]["Enums"]["forma_cobranca_extra"]
          id?: number
          motorista_codigo: string
          observacoes?: string | null
          operador?: string | null
          quitada_em?: string | null
          status?: Database["public"]["Enums"]["status_cobranca_extra"]
          valor_parcela_dia?: number
          valor_total: number
        }
        Update: {
          atualizado_em?: string
          categoria?: Database["public"]["Enums"]["categoria_cobranca_extra"]
          criado_em?: string
          descricao?: string
          forma_cobranca?: Database["public"]["Enums"]["forma_cobranca_extra"]
          id?: number
          motorista_codigo?: string
          observacoes?: string | null
          operador?: string | null
          quitada_em?: string | null
          status?: Database["public"]["Enums"]["status_cobranca_extra"]
          valor_parcela_dia?: number
          valor_total?: number
        }
        Relationships: []
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
          ear: boolean
          endereco: string | null
          foto: string | null
          foto_moto: string | null
          moto: string | null
          nome: string
          nome_familiar: string | null
          pausado: boolean
          pausado_em: string | null
          pausado_motivo: string | null
          placa: string | null
          prioridade_criterios: Json
          status: Database["public"]["Enums"]["status_motorista"]
          telefone: string | null
          telefone_familiar: string | null
          vistoria_em: string | null
          vistoria_status: string
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
          ear?: boolean
          endereco?: string | null
          foto?: string | null
          foto_moto?: string | null
          moto?: string | null
          nome: string
          nome_familiar?: string | null
          pausado?: boolean
          pausado_em?: string | null
          pausado_motivo?: string | null
          placa?: string | null
          prioridade_criterios?: Json
          status?: Database["public"]["Enums"]["status_motorista"]
          telefone?: string | null
          telefone_familiar?: string | null
          vistoria_em?: string | null
          vistoria_status?: string
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
          ear?: boolean
          endereco?: string | null
          foto?: string | null
          foto_moto?: string | null
          moto?: string | null
          nome?: string
          nome_familiar?: string | null
          pausado?: boolean
          pausado_em?: string | null
          pausado_motivo?: string | null
          placa?: string | null
          prioridade_criterios?: Json
          status?: Database["public"]["Enums"]["status_motorista"]
          telefone?: string | null
          telefone_familiar?: string | null
          vistoria_em?: string | null
          vistoria_status?: string
        }
        Relationships: []
      }
      mural_recados: {
        Row: {
          autor_nome: string
          autor_user_id: string
          criado_em: string
          fixado: boolean
          id: number
          lido_por: Json
          texto: string
        }
        Insert: {
          autor_nome: string
          autor_user_id: string
          criado_em?: string
          fixado?: boolean
          id?: number
          lido_por?: Json
          texto: string
        }
        Update: {
          autor_nome?: string
          autor_user_id?: string
          criado_em?: string
          fixado?: boolean
          id?: number
          lido_por?: Json
          texto?: string
        }
        Relationships: []
      }
      ocorrencias_pessoa: {
        Row: {
          atualizado_em: string
          corrida_id: number | null
          criado_em: string
          descricao: string
          evidencia_url: string | null
          id: string
          nivel: number
          operador_id: string | null
          operador_nome: string | null
          pessoa_codigo: string
          tipo: string
          tipo_pessoa: string
        }
        Insert: {
          atualizado_em?: string
          corrida_id?: number | null
          criado_em?: string
          descricao: string
          evidencia_url?: string | null
          id?: string
          nivel?: number
          operador_id?: string | null
          operador_nome?: string | null
          pessoa_codigo: string
          tipo: string
          tipo_pessoa: string
        }
        Update: {
          atualizado_em?: string
          corrida_id?: number | null
          criado_em?: string
          descricao?: string
          evidencia_url?: string | null
          id?: string
          nivel?: number
          operador_id?: string | null
          operador_nome?: string | null
          pessoa_codigo?: string
          tipo?: string
          tipo_pessoa?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_pessoa_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
        ]
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
      usuarios_painel: {
        Row: {
          atualizado_em: string
          criado_em: string
          email: string
          foto: string | null
          id: string
          login: string
          motivo_bloqueio: string | null
          nome: string
          senha_plain: string | null
          status: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          email: string
          foto?: string | null
          id?: string
          login: string
          motivo_bloqueio?: string | null
          nome: string
          senha_plain?: string | null
          status?: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          email?: string
          foto?: string | null
          id?: string
          login?: string
          motivo_bloqueio?: string | null
          nome?: string
          senha_plain?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cliente_alterar_senha: {
        Args: { _nova_senha: string; _senha_atual: string; _token: string }
        Returns: Json
      }
      cliente_atualizar_dados: {
        Args: {
          _bairro: string
          _cidade: string
          _email: string
          _logradouro: string
          _numero: string
          _telefone: string
          _token: string
        }
        Returns: Json
      }
      cliente_avaliar_corrida: {
        Args: {
          _comentario: string
          _corrida_id: number
          _nota_corrida: number
          _nota_motorista: number
          _token: string
        }
        Returns: Json
      }
      cliente_cadastrar: {
        Args: {
          _bairro: string
          _cidade: string
          _cpf: string
          _email: string
          _ip?: string
          _logradouro: string
          _nome: string
          _numero: string
          _senha: string
          _telefone: string
          _termos_versao: string
          _user_agent?: string
        }
        Returns: Json
      }
      cliente_cotar: {
        Args: { _distancia_km: number; _qtd_paradas?: number }
        Returns: Json
      }
      cliente_enviar_mensagem: {
        Args: { _texto: string; _token: string }
        Returns: Json
      }
      cliente_listar_corridas: {
        Args: { _token: string }
        Returns: {
          agendada_para: string | null
          aguardando_registro: boolean
          alerta_antes_min: number
          alerta_disparado: boolean
          atualizado_em: string
          avaliacao_comentario: string | null
          avaliacao_corrida: number | null
          avaliacao_motorista: number | null
          avaliada_em: string | null
          cliente: string | null
          cliente_codigo: string | null
          criado_em: string
          despacho: Database["public"]["Enums"]["despacho_corrida"]
          destino: string | null
          destino_lat: number | null
          destino_lng: number | null
          distancia_km: number | null
          eta_chegada_em: string | null
          eta_coleta_atualizado_em: string | null
          eta_coleta_segundos: number | null
          finalizada_em: string | null
          id: number
          modelo: Database["public"]["Enums"]["modelo_corrida"]
          motorista: string | null
          motorista_codigo: string | null
          motoristas_manuais: string[]
          observacoes: string | null
          origem: string
          origem_lat: number | null
          origem_lng: number | null
          pagamento: Database["public"]["Enums"]["tipo_pagamento"] | null
          paradas: Json
          passageiros: Json
          rodada_atual: number
          solicitacoes_especiais: string[]
          status: Database["public"]["Enums"]["status_corrida"]
          telefone_cliente: string | null
          tipo: string | null
          valor_final: number
          valor_paradas: number
        }[]
        SetofOptions: {
          from: "*"
          to: "corridas"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cliente_listar_mensagens: {
        Args: { _token: string }
        Returns: {
          autor: string
          autor_nome: string | null
          cliente_codigo: string
          criado_em: string
          id: number
          lido: boolean
          texto: string
        }[]
        SetofOptions: {
          from: "*"
          to: "chat_cliente"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cliente_login: {
        Args: {
          _email: string
          _ip?: string
          _senha: string
          _user_agent?: string
        }
        Returns: Json
      }
      cliente_logout: { Args: { _token: string }; Returns: undefined }
      cliente_me: { Args: { _token: string }; Returns: Json }
      cliente_motoristas_online: {
        Args: never
        Returns: {
          codigo: string
          lat: number
          lng: number
          nome: string
          status: string
        }[]
      }
      cliente_redefinir_senha: {
        Args: { _nova_senha: string; _token: string }
        Returns: Json
      }
      cliente_solicitar_corrida: {
        Args: {
          _destino: string
          _destino_lat: number
          _destino_lng: number
          _distancia_km: number
          _forma_pagamento?: string
          _observacoes: string
          _origem: string
          _origem_lat: number
          _origem_lng: number
          _paradas: Json
          _solicitacoes_especiais?: string[]
          _token: string
          _valor: number
        }
        Returns: Json
      }
      cliente_solicitar_reset: { Args: { _email: string }; Returns: Json }
      dia_operacional: { Args: { _ts?: string }; Returns: string }
      eh_modo_automatico: { Args: never; Returns: boolean }
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
      recomputa_cobranca_motorista: {
        Args: { _codigo: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "operador"
      categoria_cobranca_extra:
        | "uniforme"
        | "itens_cliente"
        | "manutencao"
        | "equipamento"
        | "multa"
        | "adiantamento"
        | "outros"
      despacho_corrida: "Automatico" | "Manual" | "WhatsApp"
      forma_cobranca_extra: "por_dia" | "parcela_fixa" | "avulsa"
      modelo_corrida: "Imediata" | "Agendada"
      status_cobranca_extra: "aberta" | "quitada" | "cancelada"
      status_corrida:
        | "Pendente"
        | "Ofertada"
        | "Aceita"
        | "A caminho"
        | "Chegou"
        | "Em viagem"
        | "Finalizada"
        | "Cancelada"
        | "Agendada"
        | "Parada"
      status_motorista:
        | "Offline"
        | "Online"
        | "Em corrida"
        | "Bloqueado"
        | "Excluido"
      status_motorista_auth: "Ativo" | "Bloqueado"
      tipo_alerta_motorista: "panico" | "suspeito"
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
      categoria_cobranca_extra: [
        "uniforme",
        "itens_cliente",
        "manutencao",
        "equipamento",
        "multa",
        "adiantamento",
        "outros",
      ],
      despacho_corrida: ["Automatico", "Manual", "WhatsApp"],
      forma_cobranca_extra: ["por_dia", "parcela_fixa", "avulsa"],
      modelo_corrida: ["Imediata", "Agendada"],
      status_cobranca_extra: ["aberta", "quitada", "cancelada"],
      status_corrida: [
        "Pendente",
        "Ofertada",
        "Aceita",
        "A caminho",
        "Chegou",
        "Em viagem",
        "Finalizada",
        "Cancelada",
        "Agendada",
        "Parada",
      ],
      status_motorista: [
        "Offline",
        "Online",
        "Em corrida",
        "Bloqueado",
        "Excluido",
      ],
      status_motorista_auth: ["Ativo", "Bloqueado"],
      tipo_alerta_motorista: ["panico", "suspeito"],
      tipo_pagamento: ["Dinheiro", "Pix", "Cartão", "Maquininha", "Conta"],
    },
  },
} as const
