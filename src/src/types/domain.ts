export type UserRole = 'gestor' | 'fpna_admin';

export interface Profile {
  id: string;
  nome: string;
  email: string;
  papel: UserRole;
}

export interface CostCenter {
  id: string;
  codigo: string;
  nome: string;
  diretoria_pai: string | null;
  ativo: boolean;
}

export interface ManagerialAccount {
  id: string;
  cost_center_id: string;
  nome: string;
  ordem_exibicao: number;
}

export interface Supplier {
  id: string;
  nome_padronizado: string;
  nomes_alternativos: string[];
}

export interface MonthlyEntry {
  id: string;
  cost_center_id: string;
  managerial_account_id: string;
  supplier_id: string | null;
  ano: number;
  mes: number;
  valor: number;
}
