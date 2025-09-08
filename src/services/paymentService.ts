import { supabase } from '@/integrations/supabase/client';

export interface CustomerPayment {
  id?: string;
  customer_id?: string | null;
  customer_name: string;
  contract_number?: number | null;
  amount: number;
  method?: 'cash' | 'bank' | 'transfer' | 'card' | 'check' | 'other' | null;
  reference?: string | null;
  notes?: string | null;
  paid_at?: string; // ISO date
  created_at?: string;
  updated_at?: string;
}

export interface CustomerSummary {
  customer_name: string;
  total_rent: number;
  total_paid_from_contracts: number;
  total_payments: number;
  total_paid: number;
  remaining: number;
}

export async function getCustomerContracts(customerName: string) {
  const { data, error } = await supabase
    .from('Contract' as any)
    .select('"Contract Number", Contract_Number, "Contract Date", "End Date", "Total Rent", "Total Paid", Remaining, Company, Phone, Level, "Ad Type"')
    .or(`"Customer Name".eq.${customerName},Customer_Name.eq.${customerName}`);
  if (error) throw error;
  return (data || []).map((c: any) => {
    const number = c.Contract_Number ?? c['Contract Number'];
    return {
      contract_number: number,
      contract_date: c['Contract Date'] || null,
      end_date: c['End Date'] || null,
      total_rent: Number(c['Total Rent'] ?? 0) || 0,
      total_paid: Number(c['Total Paid'] ?? 0) || 0,
      remaining: Number(c['Remaining'] ?? (Number(c['Total Rent'] ?? 0) - Number(c['Total Paid'] ?? 0))) || 0,
      company: c.Company || null,
      phone: c.Phone || null,
      level: c.Level || null,
      ad_type: c['Ad Type'] || null,
    };
  });
}

export async function getCustomerPayments(customerName: string) {
  const { data, error } = await supabase
    .from('customer_payments' as any)
    .select('*')
    .eq('customer_name', customerName)
    .order('paid_at', { ascending: false });
  if (error) throw error;
  return (data || []) as CustomerPayment[];
}

export async function addCustomerPayment(p: CustomerPayment) {
  const payload = {
    customer_id: p.customer_id ?? null,
    customer_name: p.customer_name,
    contract_number: p.contract_number ?? null,
    amount: p.amount,
    method: p.method ?? null,
    reference: p.reference ?? null,
    notes: p.notes ?? null,
    paid_at: p.paid_at || new Date().toISOString(),
  } as any;
  const { data, error } = await supabase
    .from('customer_payments' as any)
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as CustomerPayment;
}

export async function getCustomerSummary(customerName: string): Promise<CustomerSummary> {
  const contracts = await getCustomerContracts(customerName);
  const payments = await getCustomerPayments(customerName);
  const total_rent = contracts.reduce((s, c) => s + (Number(c.total_rent) || 0), 0);
  const total_paid_from_contracts = contracts.reduce((s, c) => s + (Number(c.total_paid) || 0), 0);
  const total_payments = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const total_paid = total_paid_from_contracts + total_payments;
  const remaining = total_rent - total_paid;
  return { customer_name: customerName, total_rent, total_paid_from_contracts, total_payments, total_paid, remaining };
}
