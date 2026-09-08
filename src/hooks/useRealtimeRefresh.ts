import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useRealtimeRefresh(onChange: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        onChange();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onChange]);
}
