import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { getCustomers, syncCustomersFromContracts, type CustomerRecord } from '@/services/customerService';
import { getCustomerContracts, getCustomerPayments, getCustomerSummary, addCustomerPayment, type CustomerPayment } from '@/services/paymentService';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Users, RefreshCw, Search, Building2, Phone, CalendarRange, DollarSign, Receipt, Plus, Pencil, Trash2 } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';

export default function CustomersTable() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CustomerRecord | null>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [summary, setSummary] = useState<{ total_rent: number; total_paid: number; remaining: number } | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [editing, setEditing] = useState<CustomerPayment | null>(null);
  const [paymentForm, setPaymentForm] = useState<{ amount: string; entry_type: 'payment' | 'debt'; method: string; paid_at: string; reference: string; notes: string; contract_number: string }>({
    amount: '',
    entry_type: 'payment',
    method: 'cash',
    paid_at: new Date().toISOString().slice(0, 10),
    reference: '',
    notes: '',
    contract_number: ''
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (e: any) {
      const msg = e?.message || 'تعذر تحميل العملاء';
      toast({ title: 'خطأ', description: msg as any, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function openDetails(c: CustomerRecord) {
    setSelected(c);
    setOpen(true);
    setDetailsLoading(true);
    try {
      const [cons, pays, sum] = await Promise.all([
        getCustomerContracts(c.name),
        getCustomerPayments(c.name),
        getCustomerSummary(c.name),
      ]);
      setContracts(cons);
      setPayments(pays);
      setSummary({ total_rent: sum.total_rent, total_paid: sum.total_paid, remaining: sum.remaining });
    } catch (e: any) {
      toast({ title: 'خطأ', description: (e?.message || 'تعذر تحميل تفاصيل العميل') as any, variant: 'destructive' });
    } finally {
      setDetailsLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await syncCustomersFromContracts();
      toast({ title: 'تم التحديث', description: `تمت مزامنة ${res.total} عميل (مضاف: ${res.inserted}، محدّث: ${res.updated})` as any });
      await load();
    } catch (e: any) {
      let msg = e?.message || '';
      if (msg.includes('جدول العملاء غير موجود')) {
        msg += '\nيرجى إنشاء جدول customers في Supabase ثم إعادة المحاولة.';
      }
      toast({ title: 'خطأ في المزامنة', description: msg as any, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Users className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">العملاء</h2>
            <p className="text-muted-foreground">عرض وإدارة قائمة العملاء المستخرجة من العقود</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSync} disabled={syncing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            مزامنة من العقود
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>جدول العملاء</CardTitle>
              <CardDescription>يتم التحديث من العقود تلقائياً عب�� زر المزامنة</CardDescription>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="ابحث بالاسم أو الشركة أو الهاتف" value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="mr-2">جاري تحميل العملاء...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الشركة</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">عدد العقود</TableHead>
                  <TableHead className="text-right">إجمالي الإيجار</TableHead>
                  <TableHead className="text-right">أول عقد</TableHead>
                  <TableHead className="text-right">آخر عقد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={`${c.id || c.name}-${c.phone || ''}`} className="cursor-pointer hover:bg-muted/40" onClick={() => openDetails(c)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {c.company || 'غير محدد'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {c.phone || 'غير محدد'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.contracts_count ?? 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        {(c.total_rent ?? 0).toLocaleString('ar-LY')} د.ل
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CalendarRange className="h-4 w-4 text-muted-foreground" />
                        {c.first_contract_date ? new Date(c.first_contract_date).toLocaleDateString('ar-LY') : '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.last_contract_date ? new Date(c.last_contract_date).toLocaleDateString('ar-LY') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      لا توجد بيانات مطابقة
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>تفاصيل العميل</DrawerTitle>
            <DrawerDescription>العقود والمدفوعات والرصيد</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4" dir="rtl">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>العقود</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {detailsLoading ? (
                    <div className="p-6">جاري التحميل...</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">رقم العقد</TableHead>
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right">النهاية</TableHead>
                          <TableHead className="text-right">الإيجار</TableHead>
                          <TableHead className="text-right">مدفوع</TableHead>
                          <TableHead className="text-right">المتبقي</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contracts.map((ct) => (
                          <TableRow key={ct.contract_number}>
                            <TableCell>{ct.contract_number}</TableCell>
                            <TableCell>{ct.contract_date ? new Date(ct.contract_date).toLocaleDateString('ar-LY') : '—'}</TableCell>
                            <TableCell>{ct.end_date ? new Date(ct.end_date).toLocaleDateString('ar-LY') : '—'}</TableCell>
                            <TableCell>{Number(ct.total_rent || 0).toLocaleString('ar-LY')} د.ل</TableCell>
                            <TableCell>{Number(ct.total_paid || 0).toLocaleString('ar-LY')} د.ل</TableCell>
                            <TableCell>{Number(ct.remaining || 0).toLocaleString('ar-LY')} د.ل</TableCell>
                          </TableRow>
                        ))}
                        {contracts.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">لا توجد عقود</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle>سجل المدفوعات</CardTitle>
                  <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setPaymentModal(true); }}>
                    <Receipt className="h-4 w-4" /> إضافة قيد
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {detailsLoading ? (
                    <div className="p-6">جاري التحميل...</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right">المبلغ</TableHead>
                          <TableHead className="text-right">الطريقة</TableHead>
                          <TableHead className="text-right">العقد</TableHead>
                          <TableHead className="text-right">مرجع</TableHead>
                          <TableHead className="text-right">ملاحظات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('ar-LY') : '—'}</TableCell>
                            <TableCell>{Number(p.amount).toLocaleString('ar-LY')} د.ل</TableCell>
                            <TableCell>{p.method || '—'}</TableCell>
                            <TableCell>{p.contract_number || '—'}</TableCell>
                            <TableCell>{p.reference || '—'}</TableCell>
                            <TableCell>{p.notes || '—'}</TableCell>
                          </TableRow>
                        ))}
                        {payments.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">لا توجد مدفوعات</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>الملخص</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>إجمالي الإيجار</span>
                    <span className="font-semibold">{Number(summary?.total_rent || 0).toLocaleString('ar-LY')} د.ل</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>إجمالي المدفوع</span>
                    <span className="font-semibold text-green-600">{Number(summary?.total_paid || 0).toLocaleString('ar-LY')} د.ل</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>المتبقي</span>
                    <span className="font-semibold text-red-600">{Number(summary?.remaining || 0).toLocaleString('ar-LY')} د.ل</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Receipt className="h-4 w-4" /> إيصال جديد</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input type="number" placeholder="المبلغ" value={paymentForm.amount} onChange={(e) => setPaymentForm((s) => ({ ...s, amount: e.target.value }))} />
                  <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm((s) => ({ ...s, method: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="طريقة الدفع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">نقداً</SelectItem>
                      <SelectItem value="bank">إيداع بنكي</SelectItem>
                      <SelectItem value="transfer">تحويل</SelectItem>
                      <SelectItem value="card">بطاقة</SelectItem>
                      <SelectItem value="check">شيك</SelectItem>
                      <SelectItem value="other">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="date" value={paymentForm.paid_at} onChange={(e) => setPaymentForm((s) => ({ ...s, paid_at: e.target.value }))} />
                  <Input placeholder="رقم العقد (اختياري)" value={paymentForm.contract_number} onChange={(e) => setPaymentForm((s) => ({ ...s, contract_number: e.target.value }))} />
                  <Input placeholder="مرجع (اختياري)" value={paymentForm.reference} onChange={(e) => setPaymentForm((s) => ({ ...s, reference: e.target.value }))} />
                  <Textarea placeholder="ملاحظات" value={paymentForm.notes} onChange={(e) => setPaymentForm((s) => ({ ...s, notes: e.target.value }))} />
                  <div className="flex gap-2">
                    <Button className="gap-2" disabled={savingPayment} onClick={async () => {
                      if (!selected) return;
                      const amountNum = Number(paymentForm.amount);
                      if (!(amountNum > 0)) { toast({ title: 'الرجاء إدخال مبلغ صحيح', variant: 'destructive' } as any); return; }
                      setSavingPayment(true);
                      try {
                        await addCustomerPayment({
                          customer_id: selected.id || null,
                          customer_name: selected.name,
                          amount: amountNum,
                          method: paymentForm.method as any,
                          paid_at: new Date(paymentForm.paid_at).toISOString(),
                          reference: paymentForm.reference || null,
                          notes: paymentForm.notes || null,
                          contract_number: paymentForm.contract_number ? Number(paymentForm.contract_number) : null,
                        });
                        toast({ title: 'تم الحفظ', description: 'تم إضافة إيصال الدفع' });
                        // reload details
                        await openDetails(selected);
                        setPaymentForm((s) => ({ ...s, amount: '', reference: '', notes: '', contract_number: '' }));
                      } catch (e: any) {
                        toast({ title: 'خطأ', description: (e?.message || 'تعذر حفظ الإيصال') as any, variant: 'destructive' });
                      } finally {
                        setSavingPayment(false);
                      }
                    }}>
                      <Plus className="h-4 w-4" /> حفظ الإيصال
                    </Button>
                    <DrawerClose asChild>
                      <Button variant="outline">إغلاق</Button>
                    </DrawerClose>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          <DrawerFooter />
        </DrawerContent>
      </Drawer>
    </div>
  );
}
