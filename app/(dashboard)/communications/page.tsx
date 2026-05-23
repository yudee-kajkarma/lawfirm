'use client';

import {
  Inbox,
  Mail,
  MessageCircle,
  MessageSquare,
  Send,
} from 'lucide-react';

import { ComingSoon } from '@/components/shared/ComingSoon';

export default function CommunicationsPage() {
  return (
    <ComingSoon
      icon={MessageSquare}
      eta="Coming in a later phase"
      title="Unified inbox is on its way"
      description="Send and receive client messages across email, SMS, and WhatsApp — all threaded under the lead, case, or contact they belong to."
      features={[
        {
          icon: Mail,
          title: 'Email via SendGrid',
          description: 'Send from your verified domain; replies route to the right thread automatically.',
        },
        {
          icon: Send,
          title: 'SMS via Twilio',
          description: 'Two-way text conversations with delivery + read receipts.',
        },
        {
          icon: MessageCircle,
          title: 'WhatsApp Business',
          description: 'Template messages and free-form replies inside the 24-hour window.',
        },
        {
          icon: Inbox,
          title: 'One unified inbox',
          description: 'Filter by channel, BU, owner, or smart list — same shell, all channels.',
        },
      ]}
      footer={
        <span>
          In the meantime, use Tasks and Notes to capture follow-ups. We&rsquo;ll backfill the
          history when the inbox ships.
        </span>
      }
    />
  );
}
