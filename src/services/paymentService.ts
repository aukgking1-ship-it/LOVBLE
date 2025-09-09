import { supabase } from '@/integrations/supabase/client';

export interface CustomerPayment {
  id?: string;
  customer_id?: string | null;
  customer_name: string;
  contract_number?: number | null;
  amount: number;
  entry_type?: 'payment' | 'debt' | null; // payment increases paid, debt increases remaining
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
  total_payments: number; // raw sum (absolute) of entries
  total_paid: number; // contracts-paid + payments - debts
  remaining: number;
}

export async function getCustomerContracts(customerName: string) {
  // Try filter on "Customer Name", then fallback to Customer_Name
  let res: any = await (supabase as any)
    .from('Contract')
    .select('*')
    .eq('"Customer Name"', customerName);

  if (res.error) {
    res = await (supabase as any)
      .from('Contract')
      .select('*')
      .eq('Customer_Name', customerName);
  }

  if (res.error) throw res.error;
  const data = res.data || [];

  return data.map((c: any) => {
    const number = c.Contract_Number ?? c['Contract Number'] ?? c.id ?? c.ID ?? null;
    const totalRent = Number(c['Total Rent'] ?? c.total_rent ?? 0) || 0;
    const totalPaid = Number(c['Total Paid'] ?? c.total_paid ?? 0) || 0;
    const remaining = Number(c['Remaining'] ?? (totalRent - totalPaid)) || 0;
    return {
      contract_number: number,
      contract_date: c['Contract Date'] ?? c.contract_date ?? null,
      end_date: c['End Date'] ?? c.end_date ?? null,
      total_rent: totalRent,
      total_paid: totalPaid,
      remaining,
      company: c.Company ?? null,
      phone: c.Phone ?? null,
      level: c.Level ?? null,
      ad_type: c['Ad Type'] ?? c.Ad_Type ?? null,
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
  return ((data || []) as any[]).map((p) => ({ ...p, entry_type: p.entry_type || 'payment' })) as CustomerPayment[];
}

export async function addCustomerPayment(p: CustomerPayment) {
  const payload = {
    customer_id: p.customer_id ?? null,
    customer_name: p.customer_name,
    contract_number: p.contract_number ?? null,
    amount: p.amount,
    entry_type: p.entry_type ?? 'payment',
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
  const signedPayments = payments.reduce((s, p) => s + ((p.entry_type === 'debt' ? -1 : 1) * (Number(p.amount) || 0)), 0);
  const total_payments = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const total_paid = total_paid_from_contracts + signedPayments;
  const remaining = total_rent - total_paid;
  return { customer_name: customerName, total_rent, total_paid_from_contracts, total_payments, total_paid, remaining };
}

export async function updateCustomerPayment(id: string, patch: Partial<CustomerPayment>) {
  const payload: any = { ...patch };
  if (payload.paid_at && payload.paid_at.length <= 10) {
    payload.paid_at = new Date(payload.paid_at).toISOString();
  }
  const { data, error } = await (supabase as any)
    .from('customer_payments')
    .update({
      amount: patch.amount as any,
      entry_type: (patch.entry_type as any),
      method: patch.method as any,
      reference: patch.reference as any,
      notes: patch.notes as any,
      contract_number: patch.contract_number as any,
      paid_at: (patch.paid_at as any) || undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as CustomerPayment;
}

export async function deleteCustomerPayment(id: string) {
  const { error } = await (supabase as any)
    .from('customer_payments')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
