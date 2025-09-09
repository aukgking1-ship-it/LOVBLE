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

function toAsciiDigits(input: string): string {
  const arabicIndic = ['\u0660','\u0661','\u0662','\u0663','\u0664','\u0665','\u0666','\u0667','\u0668','\u0669'];
  const easternArabicIndic = ['\u06F0','\u06F1','\u06F2','\u06F3','\u06F4','\u06F5','\u06F6','\u06F7','\u06F8','\u06F9'];
  let s = input;
  arabicIndic.forEach((d, i) => { s = s.replace(new RegExp(d, 'g'), String(i)); });
  easternArabicIndic.forEach((d, i) => { s = s.replace(new RegExp(d, 'g'), String(i)); });
  return s;
}

function num(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = toAsciiDigits(String(v));
  // Remove all non-digits (keep minus). Treat thousands separators and currency as non-digits.
  const cleaned = s.replace(/[^0-9-]/g, '');
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
}

function parseContractNumberToInt(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const digits = String(v).match(/\d+/g)?.join('') || '';
  if (!digits) return null;
  const n = Number(digits);
  return isFinite(n) ? n : null;
}

export async function getCustomerContracts(customerName: string) {
  // Read rows without referencing fragile column names in SQL; filter in JS
  const res: any = await (supabase as any)
    .from('Contract')
    .select('*');
  if (res.error) throw res.error;
  const all = (res.data || []) as any[];
  const data = all.filter((c) => {
    const name = c['Customer Name'] ?? c.Customer_Name ?? c.customer_name ?? '';
    return String(name) === String(customerName);
  });

  return data.map((c: any) => {
    const number = c['Contract Number'] ?? c.Contract_Number ?? c.id ?? c.ID ?? null;
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

export async function syncContractPaymentsForCustomer(customerName: string): Promise<{ inserted: number; skipped: number }> {
  // Fetch contracts for this customer with payment columns
  // Avoid column-name mismatches: load and filter in JS
  const q = await (supabase as any)
    .from('Contract')
    .select('*');
  if (q.error) throw q.error;
  const rows: any[] = (q.data || []).filter((c: any) => {
    const name = c['Customer Name'] ?? c.Customer_Name ?? c.customer_name ?? '';
    return String(name) === String(customerName);
  });

  // Build candidates
  type Candidate = { customer_name: string; contract_number: number | null; reference: string; amount: number; paid_at: string; entry_type: 'payment'; method: 'other' | null; notes: string | null };
  const candidates: Candidate[] = [];
  for (const c of rows) {
    const cnStr = c['Contract Number'] ?? c.Contract_Number ?? '';
    const cn = parseContractNumberToInt(cnStr);
    const cdate = c['Contract Date'] ?? c.contract_date ?? null;
    const baseDateISO = cdate ? new Date(cdate).toISOString() : new Date().toISOString();
    const p1 = num(c['Payment 1'] ?? c.payment_1);
    const p2 = num(c['Payment 2'] ?? c.payment_2);
    const p3 = num(c['Payment 3'] ?? c.payment_3);
    const sumP = p1 + p2 + p3;
    if (sumP > 0) {
      [p1, p2, p3].forEach((amount, idx) => {
        if (amount > 0) {
          const ref = `Imported from contract ${String(cnStr || '')} - payment ${idx + 1}`.trim();
          candidates.push({
            customer_name: customerName,
            contract_number: cn,
            reference: ref,
            amount,
            paid_at: baseDateISO,
            entry_type: 'payment',
            method: 'other',
            notes: 'Imported from Contract table',
          });
        }
      });
    } else {
      const totalPaid = num(c['Total Paid'] ?? c.total_paid);
      if (totalPaid > 0) {
        const ref = `Imported from contract ${String(cnStr || '')} - total paid`;
        candidates.push({
          customer_name: customerName,
          contract_number: cn,
          reference: ref,
          amount: totalPaid,
          paid_at: baseDateISO,
          entry_type: 'payment',
          method: 'other',
          notes: 'Imported from Contract table (Total Paid)',
        });
      }
    }
  }

  if (candidates.length === 0) return { inserted: 0, skipped: 0 };

  // Fetch existing refs to avoid duplicates
  const refs = candidates.map((c) => c.reference);
  // Supabase has a limit on 'in' list size; chunk if large
  const chunkSize = 200;
  const existingRefs = new Set<string>();
  for (let i = 0; i < refs.length; i += chunkSize) {
    const chunk = refs.slice(i, i + chunkSize);
    const ex = await (supabase as any)
      .from('customer_payments')
      .select('reference')
      .eq('customer_name', customerName)
      .in('reference', chunk);
    if (ex.error) throw ex.error;
    (ex.data || []).forEach((r: any) => existingRefs.add(r.reference));
  }

  const toInsert = candidates.filter((c) => !existingRefs.has(c.reference));
  let inserted = 0;
  if (toInsert.length > 0) {
    const { error } = await (supabase as any)
      .from('customer_payments')
      .insert(toInsert.map((c) => ({
        customer_name: c.customer_name,
        contract_number: c.contract_number,
        amount: c.amount,
        entry_type: c.entry_type,
        method: c.method,
        reference: c.reference,
        notes: c.notes,
        paid_at: c.paid_at,
      })));
    if (error) throw error;
    inserted = toInsert.length;
  }

  return { inserted, skipped: candidates.length - inserted };
}

export async function syncAllContractPayments(): Promise<{ inserted: number; skipped: number; customers: number }> {
  const q = await (supabase as any)
    .from('Contract')
    .select('*');
  if (q.error) throw q.error;
  const rows: any[] = q.data || [];

  const byCustomer = new Map<string, any[]>();
  for (const r of rows) {
    const name = (r['Customer Name'] ?? r.Customer_Name ?? r.customer_name ?? '').trim();
    if (!name) continue;
    if (!byCustomer.has(name)) byCustomer.set(name, []);
    byCustomer.get(name)!.push(r);
  }

  let totalInserted = 0; let totalSkipped = 0;

  for (const [customerName, customerRows] of byCustomer.entries()) {
    const candidates: { customer_name: string; contract_number: number | null; reference: string; amount: number; paid_at: string; entry_type: 'payment'; method: 'other' | null; notes: string | null }[] = [];
    for (const c of customerRows) {
      const cnStr = c['Contract Number'] ?? c.Contract_Number ?? '';
      const cn = parseContractNumberToInt(cnStr);
      const cdate = c['Contract Date'] ?? c.contract_date ?? null;
      const baseDateISO = cdate ? new Date(cdate).toISOString() : new Date().toISOString();
      const p1 = num(c['Payment 1'] ?? c.payment_1);
      const p2 = num(c['Payment 2'] ?? c.payment_2);
      const p3 = num(c['Payment 3'] ?? c.payment_3);
      const sumP = p1 + p2 + p3;
      if (sumP > 0) {
        [p1, p2, p3].forEach((amount, idx) => {
          if (amount > 0) {
            const ref = `Imported from contract ${String(cnStr || '')} - payment ${idx + 1}`.trim();
            candidates.push({
              customer_name: customerName,
              contract_number: cn,
              reference: ref,
              amount,
              paid_at: baseDateISO,
              entry_type: 'payment',
              method: 'other',
              notes: 'Imported from Contract table',
            });
          }
        });
      } else {
        const totalPaid = num(c['Total Paid'] ?? c.total_paid);
        if (totalPaid > 0) {
          const ref = `Imported from contract ${String(cnStr || '')} - total paid`;
          candidates.push({
            customer_name: customerName,
            contract_number: cn,
            reference: ref,
            amount: totalPaid,
            paid_at: baseDateISO,
            entry_type: 'payment',
            method: 'other',
            notes: 'Imported from Contract table (Total Paid)',
          });
        }
      }
    }

    if (candidates.length === 0) continue;

    const refs = candidates.map((c) => c.reference);
    const existingRefs = new Set<string>();
    const chunkSize = 200;
    for (let i = 0; i < refs.length; i += chunkSize) {
      const chunk = refs.slice(i, i + chunkSize);
      const ex = await (supabase as any)
        .from('customer_payments')
        .select('reference')
        .eq('customer_name', customerName)
        .in('reference', chunk);
      if (ex.error) throw ex.error;
      (ex.data || []).forEach((r: any) => existingRefs.add(r.reference));
    }

    const toInsert = candidates.filter((c) => !existingRefs.has(c.reference));
    if (toInsert.length > 0) {
      const { error } = await (supabase as any)
        .from('customer_payments')
        .insert(toInsert);
      if (error) throw error;
    }
    totalInserted += toInsert.length;
    totalSkipped += candidates.length - toInsert.length;
  }

  return { inserted: totalInserted, skipped: totalSkipped, customers: byCustomer.size };
}
