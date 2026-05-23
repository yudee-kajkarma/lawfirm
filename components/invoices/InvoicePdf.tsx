'use client';

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import type { Invoice } from '@/types/invoice';

import { formatCurrency, formatDate } from './format';

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 48,
    paddingVertical: 56,
    fontSize: 10,
    color: '#0f172a',
    fontFamily: 'Helvetica',
  },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  brand: { fontSize: 18, fontWeight: 700 },
  brandSub: { fontSize: 9, color: '#64748b', marginTop: 2 },

  invoiceMeta: { alignItems: 'flex-end' },
  invoiceLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 },
  invoiceNumber: { fontSize: 16, fontWeight: 700, marginTop: 2 },
  status: {
    fontSize: 9,
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    color: '#0f172a',
  },

  twoCol: { flexDirection: 'row', marginBottom: 32 },
  col: { flex: 1, paddingRight: 12 },
  colLabel: {
    fontSize: 9,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  colLine: { marginTop: 2 },
  bold: { fontWeight: 700 },

  table: { marginBottom: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    color: '#64748b',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cellDesc: { flex: 3 },
  cellNum: { flex: 1, textAlign: 'right' },

  totals: { marginLeft: 'auto', width: '40%', marginTop: 8 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalsMuted: { color: '#64748b' },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
    fontWeight: 700,
    fontSize: 12,
  },

  notes: { marginTop: 28 },
  notesLabel: {
    fontSize: 9,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  notesText: { fontSize: 10, lineHeight: 1.5 },

  footer: { marginTop: 48, fontSize: 8, color: '#94a3b8', textAlign: 'center' },
});

type Props = {
  invoice: Invoice;
  /** Defaults to a sensible "InstaPath CRM" — wire to the org name once the settings doc has it. */
  organizationName?: string;
};

export function InvoicePdf({ invoice, organizationName = 'InstaPath' }: Props) {
  const i = invoice;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>{organizationName}</Text>
            <Text style={styles.brandSub}>{i.businessUnit.toUpperCase()} business unit</Text>
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceLabel}>Invoice</Text>
            <Text style={styles.invoiceNumber}>{i.invoiceNumber}</Text>
            <Text style={styles.status}>{i.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.colLabel}>Bill to</Text>
            <Text style={[styles.colLine, styles.bold]}>
              {i.clientSnapshot?.name ?? '—'}
            </Text>
            {i.clientSnapshot?.companyName && (
              <Text style={styles.colLine}>{i.clientSnapshot.companyName}</Text>
            )}
            {i.clientSnapshot?.email && (
              <Text style={styles.colLine}>{i.clientSnapshot.email}</Text>
            )}
            {i.clientSnapshot?.address && (
              <Text style={styles.colLine}>{i.clientSnapshot.address}</Text>
            )}
          </View>
          <View style={styles.col}>
            <Text style={styles.colLabel}>Issued</Text>
            <Text style={styles.colLine}>{formatDate(i.issueDate)}</Text>
            <Text style={[styles.colLabel, { marginTop: 12 }]}>Due</Text>
            <Text style={[styles.colLine, styles.bold]}>{formatDate(i.dueDate)}</Text>
            {i.title && (
              <>
                <Text style={[styles.colLabel, { marginTop: 12 }]}>Reference</Text>
                <Text style={styles.colLine}>{i.title}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.cellDesc}>Description</Text>
            <Text style={styles.cellNum}>Qty</Text>
            <Text style={styles.cellNum}>Unit price</Text>
            <Text style={styles.cellNum}>Amount</Text>
          </View>
          {i.lineItems.map((li, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={styles.cellDesc}>{li.description}</Text>
              <Text style={styles.cellNum}>{li.quantity}</Text>
              <Text style={styles.cellNum}>{formatCurrency(li.unitPrice, i.currency)}</Text>
              <Text style={styles.cellNum}>{formatCurrency(li.amount, i.currency)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsMuted}>Subtotal</Text>
            <Text>{formatCurrency(i.subtotal, i.currency)}</Text>
          </View>
          {i.discountAmount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsMuted}>Discount ({i.discountPercent}%)</Text>
              <Text>−{formatCurrency(i.discountAmount, i.currency)}</Text>
            </View>
          )}
          {i.taxAmount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsMuted}>Tax ({i.taxRate}%)</Text>
              <Text>{formatCurrency(i.taxAmount, i.currency)}</Text>
            </View>
          )}
          <View style={styles.grandRow}>
            <Text>Total</Text>
            <Text>{formatCurrency(i.total, i.currency)}</Text>
          </View>
        </View>

        {i.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{i.notes}</Text>
          </View>
        )}

        <Text style={styles.footer}>Generated {formatDate(new Date().toISOString())}</Text>
      </Page>
    </Document>
  );
}

export default InvoicePdf;
