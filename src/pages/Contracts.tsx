import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Plus, Eye, Edit, Trash2, Calendar, User, DollarSign } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import {
  createContract,
  getContractsPaged,
  getContractWithBillboards,
  getAvailableBillboards,
  updateContract,
  deleteContract,
  addBillboardsToContract,
  removeBillboardFromContract,
  Contract,
  ContractCreate
} from '@/services/contractService';
import { Billboard } from '@/types';

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [availableBillboards, setAvailableBillboards] = useState<Billboard[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const location = useLocation();
  const [selectedContract, setSelectedContract] = useState<any>(null);
  
  const [formData, setFormData] = useState<ContractCreate>({
    customer_name: '',
    ad_type: '',
    start_date: '',
    end_date: '',
    rent_cost: 0,
    billboard_ids: []
  });

  const [bbSearch, setBbSearch] = useState('');
  const [editBbSearch, setEditBbSearch] = useState('');

  const loadData = async () => {
    try {
      const { items, total } = await getContractsPaged(page, pageSize);
      const billboardsData = await getAvailableBillboards();
      setContracts(items as any[]);
      setTotal(total);
      setAvailableBillboards(billboardsData || []);
    } catch (error) {
      console.error('خطأ في تحميل البيانات:', error);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cn = params.get('contract');
    if (cn && !viewOpen) {
      handleViewContract(String(cn));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const handleCreateContract = async () => {
    try {
      if (!formData.customer_name || !formData.start_date || !formData.end_date || formData.billboard_ids.length === 0) {
        toast.error('يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      await createContract(formData);
      toast.success('تم إنشاء العقد بنجاح');
      setCreateOpen(false);
      setFormData({
        customer_name: '',
        ad_type: '',
        start_date: '',
        end_date: '',
        rent_cost: 0,
        billboard_ids: []
      });
      loadData();
    } catch (error) {
      console.error('خطأ في إنشاء العقد:', error);
      toast.error('فشل في إنشاء العقد');
    }
  };

  const handleViewContract = async (contractId: string) => {
    try {
      const contractWithBillboards = await getContractWithBillboards(contractId);
      setSelectedContract(contractWithBillboards);
      setViewOpen(true);
    } catch (error) {
      console.error('خطأ في جلب تفاصيل العقد:', error);
      toast.error('فشل في جلب تفاصيل العقد');
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا العقد؟')) {
      try {
        await deleteContract(contractId);
        toast.success('تم حذف العقد بنجاح');
        const nextTotal = Math.max(0, total - 1);
        const lastPage = Math.max(1, Math.ceil(nextTotal / pageSize));
        setPage((p) => Math.min(p, lastPage));
        loadData();
      } catch (error) {
        console.error('خطأ في حذف العقد:', error);
        toast.error('فشل في حذف العقد');
      }
    }
  };

  const getContractStatus = (contract: Contract) => {
    const today = new Date();
    const endDate = new Date(contract.end_date);
    const startDate = new Date(contract.start_date);
    
    if (today < startDate) {
      return <Badge className="bg-blue-500 text-white">لم يبدأ</Badge>;
    } else if (today > endDate) {
      return <Badge className="bg-red-500 text-white">منتهي</Badge>;
    } else {
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 7) {
        return <Badge className="bg-yellow-500 text-white">ينتهي قريب��ً ({daysRemaining} أيام)</Badge>;
      }
      return <Badge className="bg-green-500 text-white">نشط</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل العقود...</p>
        </div>
      </div>
    );
  }

  const filteredAvailable = availableBillboards.filter((b) => {
    const q = bbSearch.trim().toLowerCase();
    if (!q) return true;
    return [b.name, b.location, b.size, (b as any).city]
      .some((v) => String(v || '').toLowerCase().includes(q));
  });

  const selectedBillboardsDetails = (formData.billboard_ids
    .map((id) => availableBillboards.find((b) => b.id === id))
    .filter(Boolean)) as Billboard[];

  return (
    <div className="space-y-6">
      {/* العنوان والأزرار */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">إدارة العقود</h1>
          <p className="text-muted-foreground">إنشاء وإدارة عقود الإيج��ر مع اللوحات الإ��لانية</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-white shadow-elegant hover:shadow-glow transition-smooth">
              <Plus className="h-4 w-4 ml-2" />
              إنشاء عقد جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl">
            <DialogHeader>
              <DialogTitle>إنشاء عقد جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Card className="border">
                <CardHeader>
                  <CardTitle className="text-base">بيانات الزبون والحساب</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="md:col-span-2">
                      <Label>اسم الزبون *</Label>
                      <Input
                        value={formData.customer_name}
                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                        placeholder="اسم الزبون"
                      />
                    </div>
                    <div>
                      <Label>نوع الإعلان</Label>
                      <Input
                        value={formData.ad_type}
                        onChange={(e) => setFormData({ ...formData, ad_type: e.target.value })}
                        placeholder="نوع الإعلان"
                      />
                    </div>
                    <div>
                      <Label>تاريخ البداية *</Label>
                      <Input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>تاريخ النهاية *</Label>
                      <Input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>تكلفة الإيجار *</Label>
                      <Input
                        type="number"
                        value={formData.rent_cost}
                        onChange={(e) => setFormData({ ...formData, rent_cost: Number(e.target.value) })}
                        placeholder="التكلفة بالدينار الليبي"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border">
                  <CardHeader>
                    <CardTitle className="text-base">كل اللوحات المتاحة ({filteredAvailable.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3">
                      <Input placeholder="بحث..." value={bbSearch} onChange={(e) => setBbSearch(e.target.value)} />
                    </div>
                    <div className="max-h-96 overflow-auto space-y-2">
                      {filteredAvailable.map((b) => (
                        <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <div className="font-medium">{b.name}</div>
                            <div className="text-xs text-muted-foreground">{b.location} • {b.size}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={formData.billboard_ids.includes(b.id)}
                            onClick={() => setFormData({
                              ...formData,
                              billboard_ids: formData.billboard_ids.includes(b.id)
                                ? formData.billboard_ids
                                : [...formData.billboard_ids, b.id]
                            })}
                          >
                            إضافة
                          </Button>
                        </div>
                      ))}
                      {filteredAvailable.length === 0 && (
                        <p className="text-sm text-muted-foreground">لا توجد نتائج</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border">
                  <CardHeader>
                    <CardTitle className="text-base">اللوحات المختارة ({formData.billboard_ids.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-96 overflow-auto space-y-2">
                      {selectedBillboardsDetails.map((b) => (
                        <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <div className="font-medium">{b.name}</div>
                            <div className="text-xs text-muted-foreground">{b.location} • {b.size}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setFormData({ ...formData, billboard_ids: formData.billboard_ids.filter((id) => id !== b.id) })}
                          >
                            إزالة
                          </Button>
                        </div>
                      ))}
                      {formData.billboard_ids.length === 0 && (
                        <p className="text-sm text-muted-foreground">لم يتم اختيار أي لوحة</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleCreateContract}>
                إنشاء العقد
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* جدول العقود */}
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            قائمة العقود ({contracts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم الزبون</TableHead>
                  <TableHead>نوع الإعلان</TableHead>
                  <TableHead>تاريخ البداية</TableHead>
                  <TableHead>تاريخ النهاية</TableHead>
                  <TableHead>التكلفة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.customer_name}</TableCell>
                    <TableCell>{contract.ad_type || (contract as any)['Ad Type'] || 'غير محدد'}</TableCell>
                    <TableCell>{contract.start_date ? new Date(contract.start_date).toLocaleDateString('ar') : '—'}</TableCell>
                    <TableCell>{contract.end_date ? new Date(contract.end_date).toLocaleDateString('ar') : '—'}</TableCell>
                    <TableCell>{(contract.rent_cost || 0).toLocaleString()} د.ل</TableCell>
                    <TableCell>{getContractStatus(contract)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewContract(String(contract.id))}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteContract(String(contract.id))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm text-muted-foreground">إجمالي: {total || '—'}</div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">حجم الصفحة</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                  <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(total > pageSize || contracts.length === pageSize || page > 1) && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }} />
                  </PaginationItem>
                  {Array.from({ length: Math.min(5, Math.ceil(total / pageSize)) }).map((_, idx) => {
                    const totalPages = Math.max(1, Math.ceil(total / pageSize));
                    const start = Math.max(1, Math.min(totalPages - 4, page - 2));
                    const p = start + idx;
                    if (p > totalPages) return null;
                    return (
                      <PaginationItem key={p}>
                        <PaginationLink href="#" isActive={p === page} onClick={(e) => { e.preventDefault(); setPage(p); }}>
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(Math.ceil(total / pageSize), p + 1)); }} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>

          {contracts.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد عقود</h3>
              <p className="text-muted-foreground">ابدأ بإنشاء عقد جديد</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* مودال عرض تفاصيل العقد */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>تفاصيل العقد</DialogTitle>
          </DialogHeader>
          
          {selectedContract && (
            <div className="space-y-6">
              {/* معلومات العقد */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5" />
                      معلومات الزبون
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p><strong>الاسم:</strong> {selectedContract.customer_name}</p>
                      <p><strong>نوع الإعلان:</strong> {selectedContract.ad_type || '—'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      تفاصيل العقد
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p><strong>تاريخ البداية:</strong> {new Date(selectedContract.start_date).toLocaleDateString('ar')}</p>
                      <p><strong>تاريخ النهاية:</strong> {new Date(selectedContract.end_date).toLocaleDateString('ar')}</p>
                      <p><strong>التكلفة:</strong> {selectedContract.rent_cost?.toLocaleString()} د.ل</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* اللوحات المرتبطة */}
              <Card>
                <CardHeader>
                  <CardTitle>اللوحات المرتبطة بالعقد ({selectedContract.billboards?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedContract.billboards && selectedContract.billboards.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedContract.billboards.map((billboard: any) => (
                        <Card key={billboard.ID || billboard.id} className="border">
                          <CardContent className="p-4 flex items-center justify-between gap-3">
                            <div>
                              <h4 className="font-semibold">{billboard.Billboard_Name || billboard.name}</h4>
                              <p className="text-sm text-muted-foreground">{billboard.Nearest_Landmark || billboard.location}</p>
                              <p className="text-sm">الحجم: {billboard.Size || billboard.size}</p>
                              <p className="text-sm">المدينة: {billboard.City || billboard.city}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={async () => {
                                try {
                                  const contractNumber = String(selectedContract.Contract_Number ?? selectedContract['Contract Number'] ?? selectedContract.id);
                                  await removeBillboardFromContract(contractNumber, billboard.ID || billboard.id);
                                  toast.success('تم إزالة اللوحة من العقد');
                                  const refreshed = await getContractWithBillboards(contractNumber);
                                  setSelectedContract(refreshed);
                                  const av = await getAvailableBillboards();
                                  setAvailableBillboards(av || []);
                                } catch (e) {
                                  console.error(e);
                                  toast.error('فشل إزالة اللوحة');
                                }
                              }}
                            >
                              إزالة
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">لا توجد لوحات مرتبطة بهذا العقد</p>
                  )}
                </CardContent>
              </Card>

              {/* ��لتعديل: إضافة لوحات أثناء سريان العقد */}
              {(() => {
                const today = new Date();
                const start = selectedContract.start_date ? new Date(selectedContract.start_date) : (selectedContract['Contract Date'] ? new Date(selectedContract['Contract Date']) : null);
                const end = selectedContract.end_date ? new Date(selectedContract.end_date) : (selectedContract['End Date'] ? new Date(selectedContract['End Date']) : null);
                const active = start && end && today >= start && today <= end;
                if (!active) return null;
                const filtered = (availableBillboards || []).filter((b) => {
                  const q = editBbSearch.trim().toLowerCase();
                  if (!q) return true;
                  return [b.Billboard_Name, b.Nearest_Landmark, b.City, b.Size]
                    .some((v: any) => String(v || '').toLowerCase().includes(q));
                });
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">إضافة لوحات إلى العقد (نشط)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-3">
                        <Input placeholder="بحث عن لوحة..." value={editBbSearch} onChange={(e) => setEditBbSearch(e.target.value)} />
                      </div>
                      <div className="max-h-96 overflow-auto space-y-2">
                        {filtered.map((b: any) => (
                          <div key={b.ID} className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <div className="font-medium">{b.Billboard_Name}</div>
                              <div className="text-xs text-muted-foreground">{b.Nearest_Landmark} • {b.Size}</div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  const contractNumber = String(selectedContract.Contract_Number ?? selectedContract['Contract Number'] ?? selectedContract.id);
                                  await addBillboardsToContract(contractNumber, [b.ID], {
                                    start_date: selectedContract.start_date || selectedContract['Contract Date'],
                                    end_date: selectedContract.end_date || selectedContract['End Date'],
                                    customer_name: selectedContract.customer_name || selectedContract['Customer Name'] || '',
                                  });
                                  toast.success('تم إضافة اللوحة إلى العقد');
                                  const refreshed = await getContractWithBillboards(contractNumber);
                                  setSelectedContract(refreshed);
                                  const av = await getAvailableBillboards();
                                  setAvailableBillboards(av || []);
                                } catch (e) {
                                  console.error(e);
                                  toast.error('فشل إضافة اللوحة');
                                }
                              }}
                            >
                              إضافة
                            </Button>
                          </div>
                        ))}
                        {filtered.length === 0 && (
                          <p className="text-sm text-muted-foreground">لا توجد لوحات متاحة مطابقة</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
              <div className="flex justify-end pt-2">
                <DialogClose asChild>
                  <Button variant="outline">إغلاق</Button>
                </DialogClose>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
