import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function ComingSoon({ module = 'Module' }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: 'rgba(201,168,76,0.1)' }}
        >
          <Clock className="w-7 h-7" style={{ color: 'var(--brand-accent)' }} />
        </div>
        <h2 className="text-xl font-bold text-[#0b1220] mb-2">{module}</h2>
        <p className="text-sm text-[#5b6475] mb-6">
          This module is coming in a future session. Currently building Block 1: App Shell & Dashboard.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/app/dashboard')}
          className="gap-2"
        >
          Back to Dashboard
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
