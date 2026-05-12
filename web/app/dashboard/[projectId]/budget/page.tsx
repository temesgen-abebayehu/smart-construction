'use client'

import { use, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { getProjectBudget, listBudgetPayments, recordBudgetPayment } from '@/lib/api'
import type { BudgetSummary, BudgetPaymentItem } from '@/lib/api-types'
import { ArrowDownCircle, ArrowUpCircle, DollarSign, Loader2, Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useCurrency } from '@/lib/currency-context'
import { CurrencyPicker } from '@/components/currency-picker'
import { toast } from 'sonner'

interface BudgetPageProps {
  params: Promise<{ projectId: string }>
}

export default function BudgetPage({ params }: BudgetPageProps) {
  const { projectId } = use(params)
  const { formatBudget } = useCurrency()

  const [summary, setSummary] = useState<BudgetSummary | null>(null)
  const [payments, setPayments] = useState<BudgetPaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [adding, setAdding] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [budgetData, paymentsData] = await Promise.all([
        getProjectBudget(projectId),
        listBudgetPayments(projectId).catch(() => []),
      ])
      setSummary(budgetData)
      setPayments(Array.isArray(paymentsData) ? paymentsData : [])
    } catch {
      setSummary(null)
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [projectId])

  const handleRecordPayment = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }
    if (!paymentDate) {
      toast.error('Payment date is required')
      return
    }
    setAdding(true)
    try {
      await recordBudgetPayment(projectId, {
        payment_amount: Number(amount),
        payment_date: paymentDate,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      setAddOpen(false)
      setAmount('')
      setPaymentDate(new Date().toISOString().split('T')[0])
      setReference('')
      setNotes('')
      await loadData()
      toast.success('Payment recorded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to record payment')
    } finally {
      setAdding(false)
    }
  }

  const usedPct = summary ? Math.min(100, (summary.budget_spent / Math.max(summary.total_budget, 1)) * 100) : 0
  const receivedPct = summary ? Math.min(100, (summary.total_received / Math.max(summary.total_budget, 1)) * 100) : 0
  const outstanding = summary ? summary.total_budget - summary.total_received : 0

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Budget Management</h1>
          <p className="text-sm text-muted-foreground">Track client payments and project expenditures</p>
        </div>
        <div className="flex items-center gap-2">
          <CurrencyPicker />
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Record Payment
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contract Value</p>
                  <p className="mt-2 text-2xl font-bold">{formatBudget(summary.total_budget)}</p>
                </div>
                <div className="rounded-full border border-blue-200 p-3 text-blue-600">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total Received</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-600">{formatBudget(summary.total_received)}</p>
                  <p className="text-xs text-muted-foreground">{receivedPct.toFixed(1)}% of contract</p>
                </div>
                <div className="rounded-full border border-emerald-200 p-3 text-emerald-600">
                  <ArrowDownCircle className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total Spent</p>
                  <p className="mt-2 text-2xl font-bold text-amber-600">{formatBudget(summary.budget_spent)}</p>
                  <p className="text-xs text-muted-foreground">{usedPct.toFixed(1)}% of contract</p>
                </div>
                <div className="rounded-full border border-amber-200 p-3 text-amber-600">
                  <ArrowUpCircle className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Remaining Budget</p>
                  <p className={`mt-2 text-2xl font-bold ${summary.remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatBudget(summary.remaining)}
                  </p>
                  <p className="text-xs text-muted-foreground">Contract - Spent</p>
                </div>
                <div className={`rounded-full border p-3 ${summary.remaining < 0 ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'}`}>
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Outstanding</p>
                  <p className={`mt-2 text-2xl font-bold ${outstanding > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
                    {formatBudget(outstanding)}
                  </p>
                  <p className="text-xs text-muted-foreground">To be received</p>
                </div>
                <div className={`rounded-full border p-3 ${outstanding > 0 ? 'border-blue-200 text-blue-600' : 'border-gray-200 text-muted-foreground'}`}>
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Budget Usage Progress */}
      {summary && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Budget Usage</CardTitle>
            <CardDescription>Spending vs Contract Value</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Spent</span>
                <span className="text-sm text-muted-foreground">{usedPct.toFixed(1)}%</span>
              </div>
              <Progress
                value={usedPct}
                className={`h-2.5 ${usedPct > 90 ? '[&>div]:bg-red-500' : usedPct > 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Received</span>
                <span className="text-sm text-muted-foreground">{receivedPct.toFixed(1)}%</span>
              </div>
              <Progress
                value={receivedPct}
                className="h-2.5 [&>div]:bg-emerald-500"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client Payments Table */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Client Payments</CardTitle>
            <CardDescription>{payments.length} payment{payments.length !== 1 ? 's' : ''} received</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                    <DollarSign className="mx-auto mb-2 h-8 w-8 opacity-30" />
                    No payments recorded yet. Click &quot;Record Payment&quot; to track client payments.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-sm">
                      {new Date(payment.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="font-medium">{payment.reference || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{payment.notes || '—'}</TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">{formatBudget(payment.payment_amount)}</TableCell>
                  </TableRow>
                ))
              )}
              {payments.length > 0 && (
                <TableRow className="bg-muted/30 font-medium">
                  <TableCell colSpan={3}>Total Received</TableCell>
                  <TableCell className="text-right text-emerald-600">{formatBudget(payments.reduce((s, p) => s + p.payment_amount, 0))}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Client Payment</DialogTitle>
            <DialogDescription>Track a payment received from the client for this project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Payment Amount (ETB) *</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="e.g. 500000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Date *</Label>
              <Input
                type="date"
                max={new Date().toISOString().split('T')[0]}
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input
                placeholder="e.g. Bank ref, Payment certificate #"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional details about this payment"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleRecordPayment()} disabled={adding || !amount || !paymentDate}>
              {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
