import type { Billboard, Contract } from '@/types';
import { supabase } from '@/integrations/supabase/client';

interface ContractData {
  customer_name: string;
  start_date: string;
  end_date: string;
  rent_cost: number;
  discount?: number;
  billboard_ids?: string[];
  ad_type?: string;
}

interface ContractCreate {
  customer_name: string;
  start_date: string;
  end_date: string;
  rent_cost: number;
  discount?: number;
  ad_type?: string;
  billboard_ids?: string[];
}

// إنشاء عقد جديد
export async function createContract(contractData: ContractData) {
  // فصل معرفات اللوحات عن بيانات العقد
  const { billboard_ids, ...contractPayload } = contractData;
  
  // إنشاء العقد
  const { data: contract, error: contractError } = await supabase
    .from('Contract')
    .insert({
      'Customer Name': contractPayload.customer_name,
      'Ad Type': contractPayload.ad_type || '',
      'Contract Date': contractPayload.start_date,
      'End Date': contractPayload.end_date,
      'Total Rent': contractPayload.rent_cost,
      'Discount': contractPayload.discount ?? null
    })
    .select()
    .single();

  if (contractError) throw contractError;

  // تحديث اللوحات المرتبطة بالعقد
  if (billboard_ids && billboard_ids.length > 0) {
    for (const billboard_id of billboard_ids) {
      const newContractNumber = (contract as any)?.Contract_Number ?? (contract as any)?.['Contract Number'];
      const { error: billboardError } = await supabase
        .from('billboards')
        .update({
          Contract_Number: newContractNumber,
          Rent_Start_Date: contractData.start_date,
          Rent_End_Date: contractData.end_date,
          Customer_Name: contractData.customer_name,
          Status: 'rented'
        })
        .eq('ID', Number(billboard_id));

      if (billboardError) throw billboardError;
    }
  }

  return contract;
}

// جلب جميع العقود
export async function getContracts() {
  const { data, error } = await supabase
    .from('Contract')
    .select('*')
    .order('"Contract Date"', { ascending: false });

  if (error) throw error;
  return (data || []).map((c: any) => {
    const id = c.Contract_Number ?? c['Contract Number'] ?? c.id ?? c.ID;
    return {
      ...c,
      id,
      Contract_Number: c.Contract_Number ?? c['Contract Number'] ?? id,
      'Contract Number': c['Contract Number'] ?? c.Contract_Number ?? id,
      customer_name: c.customer_name ?? c['Customer Name'] ?? c.Customer_Name ?? '',
      ad_type: c.ad_type ?? c['Ad Type'] ?? c.Ad_Type ?? '',
      start_date: c.start_date ?? c['Contract Date'] ?? c.contract_date ?? '',
      end_date: c.end_date ?? c['End Date'] ?? c.end_date ?? '',
      rent_cost: typeof c.rent_cost === 'number' ? c.rent_cost : Number(c['Total Rent'] ?? 0),
      status: c.status ?? c['Print Status'] ?? '',
    } as any;
  });
}

// جلب عقد مع اللوحات المرتبطة به
export async function getContractWithBillboards(contractId: string): Promise<any> {
  try {
    const numId = Number(contractId);
    const queryId: any = Number.isFinite(numId) && !isNaN(numId) ? numId : contractId;
    let contractResult: any = await (supabase as any)
      .from('Contract')
      .select('*')
      .eq('Contract_Number', queryId)
      .maybeSingle();

    if ((contractResult.error || !contractResult.data) && String(contractId) !== String(queryId)) {
      // محاولة أخيرة على النص الأصلي إن كانت القيم مختلفة تماماً
      contractResult = await (supabase as any)
        .from('Contract')
        .select('*')
        .eq('Contract_Number', contractId)
        .maybeSingle();
    }

    if (contractResult.error) throw contractResult.error;

    const billboardResult: any = await (supabase as any)
      .from('billboards')
      .select('*')
      .eq('Contract_Number', contractId);

    const c = contractResult.data || {};
    const normalized = {
      ...c,
      id: c.Contract_Number ?? c['Contract Number'] ?? c.id ?? c.ID,
      Contract_Number: c.Contract_Number ?? c['Contract Number'],
      'Contract Number': c['Contract Number'] ?? c.Contract_Number,
      customer_name: c.customer_name ?? c['Customer Name'] ?? c.Customer_Name ?? '',
      ad_type: c.ad_type ?? c['Ad Type'] ?? c.Ad_Type ?? '',
      start_date: c.start_date ?? c['Contract Date'] ?? c.contract_date ?? '',
      end_date: c.end_date ?? c['End Date'] ?? c.end_date ?? '',
      rent_cost: typeof c.rent_cost === 'number' ? c.rent_cost : Number(c['Total Rent'] ?? 0),
    } as any;

    return {
      ...normalized,
      billboards: (billboardResult.data || []) as any[],
    };
  } catch (error) {
    throw error;
  }
}

// جلب اللوحات المتاحة
export async function getAvailableBillboards() {
  const { data, error } = await supabase
    .from('billboards')
    .select('*')
    .eq('Status', 'available')
    .order('ID', { ascending: true });

  if (error) throw error;
  return data;
}

// تحديث عقد
export async function updateContract(contractId: string, updates: any) {
  const numId = Number(contractId);
  const queryId: any = Number.isFinite(numId) && !isNaN(numId) ? numId : contractId;

  // محاولة 1: Contract_Number
  try {
    const r1: any = await (supabase as any)
      .from('Contract')
      .update(updates)
      .eq('Contract_Number', queryId)
      .select('*')
      .maybeSingle();
    if (r1?.error) throw r1.error;
    if (r1?.data) return r1.data;
  } catch (e: any) {
    // إن كان خطأ آخر غير عدم العثور نُعيد رميه
    const msg = String(e?.message || '');
    if (msg && !/not found/i.test(msg)) {
      // لكنه قد يكون "column does not exist" عند اختلاف المخطط
      // سنكمل المحاولات الأخرى
    }
  }

  // محاولة 2: "Contract Number" إن وُجد
  try {
    const r2: any = await (supabase as any)
      .from('Contract')
      .update(updates)
      .eq('"Contract Number"', queryId)
      .select('*')
      .maybeSingle();
    if (r2?.error) {
      const msg = String(r2.error?.message || '');
      if (!/does not exist/i.test(msg)) throw r2.error;
    }
    if (r2?.data) return r2.data;
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (!/does not exist/i.test(msg)) throw e;
  }

  throw new Error('لم يتم العثور على العقد المحدد للتحديث');
}

// تحديث العقود المنتهية الصلاحية
export async function updateExpiredContracts() {
  const today = new Date().toISOString().split('T')[0];
  
  const { error } = await supabase
    .from('Contract')
    .update({ 'Print Status': 'expired' })
    .lt('End Date', today)
    .neq('Print Status', 'expired');

  if (error) throw error;
}

// إحصائيات العقود
export async function getContractsStats() {
  const { data: contracts, error } = await supabase
    .from('Contract')
    .select('*');

  if (error) throw error;
  
  const today = new Date();
  const stats = {
    total: contracts?.length || 0,
    active: contracts?.filter(c => c['End Date'] && new Date(c['End Date']) > today).length || 0,
    expired: contracts?.filter(c => c['End Date'] && new Date(c['End Date']) <= today).length || 0,
  };
  
  return stats;
}

// تحرير ا��لوحات المنتهية الصلاحية تلقائياً
export async function autoReleaseExpiredBillboards() {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: expiredContracts, error: fetchError } = await supabase
    .from('Contract')
    .select('Contract_Number, "End Date"')
    .lt('"End Date"', today);

  if (fetchError) throw fetchError;

  for (const contract of expiredContracts || []) {
    // تحديث اللوحات المرتبطة بهذا العقد
    await supabase
      .from('billboards')
      .update({
        Status: 'available',
        Contract_Number: null,
        Customer_Name: null,
        Rent_Start_Date: null,
        Rent_End_Date: null
      })
      .eq('Contract_Number', contract.Contract_Number ?? contract['Contract Number']);
  }
}

// حذف عقد
export async function deleteContract(contractNumber: string) {
  await supabase
    .from('billboards')
    .update({
      Status: 'available',
      Contract_Number: null,
      Customer_Name: null,
      Rent_Start_Date: null,
      Rent_End_Date: null
    })
    .eq('Contract_Number', contractNumber);

  const numId = Number(contractNumber);
  const queryId: any = Number.isFinite(numId) && !isNaN(numId) ? numId : contractNumber;
  const result: any = await (supabase as any)
    .from('Contract')
    .delete()
    .eq('Contract_Number', queryId);

  if (result.error) throw result.error;
}

// إضافة/إزالة لوحات من عقد
export async function addBillboardsToContract(
  contractNumber: string,
  billboardIds: (string | number)[],
  meta: { start_date: string; end_date: string; customer_name: string }
) {
  const numId = Number(contractNumber);
  const queryId: any = Number.isFinite(numId) && !isNaN(numId) ? numId : contractNumber;
  for (const id of billboardIds) {
    const { error } = await supabase
      .from('billboards')
      .update({
        Status: 'rented',
        Contract_Number: queryId,
        Customer_Name: meta.customer_name,
        Rent_Start_Date: meta.start_date,
        Rent_End_Date: meta.end_date,
      })
      .eq('ID', Number(id));
    if (error) throw error;
  }
}

export async function removeBillboardFromContract(
  contractNumber: string,
  billboardId: string | number
) {
  const numId = Number(contractNumber);
  const queryId: any = Number.isFinite(numId) && !isNaN(numId) ? numId : contractNumber;
  const { error } = await supabase
    .from('billboards')
    .update({
      Status: 'available',
      Contract_Number: null,
      Customer_Name: null,
      Rent_Start_Date: null,
      Rent_End_Date: null,
    })
    .eq('ID', Number(billboardId))
    .eq('Contract_Number', queryId);
  if (error) throw error;
}

// Export types
export type { ContractData, ContractCreate };
export type { Contract } from '@/types';
