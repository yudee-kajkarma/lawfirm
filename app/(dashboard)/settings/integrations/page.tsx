'use client';

import { Mail, MessageCircle, Plug, Send } from 'lucide-react';

import { ComingSoon } from '@/components/shared/ComingSoon';

export default function IntegrationsPage() {
  return (
    <ComingSoon
      icon={Plug}
      eta="With Email + SMS phases"
      title="Integrations settings are on their way"
      description="Configure SendGrid, Twilio, and WhatsApp credentials. Secrets are encrypted at rest with AES-256-GCM and only an admin can read them back."
      features={[
        { icon: Mail, title: 'SendGrid', description: 'Outbound email + inbound parse + delivery events.' },
        { icon: Send, title: 'Twilio', description: 'Two-way SMS with HMAC-verified webhooks.' },
        { icon: MessageCircle, title: 'WhatsApp Business', description: 'Templates + 24-hour reply window.' },
      ]}
    />
  );
}
