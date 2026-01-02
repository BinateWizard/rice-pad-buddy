import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, collection, query, orderBy, limit, onSnapshot, Query } from 'firebase/firestore';

export interface PaddyLiveData {
  nitrogen?: number;
  phosphorus?: number;
  potassium?: number;
  temperature?: number;
  humidity?: number;
  timestamp?: Date;
  deviceTimestamp?: number;
  source?: string;
}

export interface PaddyLiveState {
  data: PaddyLiveData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Live subscription to paddy sensor data from Firestore
 * Reads from: users/{userId}/fields/{fieldId}/paddies/{paddyId}/logs
 * Cloud Functions populate this collection from RTDB data
 */
export function usePaddyLiveData(
  userId: string | null,
  fieldId: string | null,
  paddyId: string | null
): PaddyLiveState {
  const [state, setState] = useState<PaddyLiveState>({
    data: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    if (!userId || !fieldId || !paddyId) {
      console.log('[usePaddyLiveData] Missing required IDs:', { userId, fieldId, paddyId });
      setState({ data: null, loading: false, error: 'Missing IDs' });
      return;
    }

    console.log('[usePaddyLiveData] Subscribing to paddy:', { userId, fieldId, paddyId });

    try {
      // Query the latest log entry for this paddy
      const logsRef = collection(db, 'users', userId, 'fields', fieldId, 'paddies', paddyId, 'logs');
      const q = query(logsRef, orderBy('timestamp', 'desc'), limit(1));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log('[usePaddyLiveData] Received snapshot, docs:', snapshot.docs.length);

        if (snapshot.empty) {
          console.log('[usePaddyLiveData] No logs found for paddy');
          setState({ data: null, loading: false, error: null });
          return;
        }

        const logDoc = snapshot.docs[0];
        const logData = logDoc.data();

        console.log('[usePaddyLiveData] Log data:', logData);

        const npkData: PaddyLiveData = {
          nitrogen: logData.nitrogen ?? undefined,
          phosphorus: logData.phosphorus ?? undefined,
          potassium: logData.potassium ?? undefined,
          temperature: logData.temperature ?? undefined,
          humidity: logData.humidity ?? undefined,
          timestamp: logData.timestamp?.toDate?.() ?? new Date(),
          deviceTimestamp: logData.deviceTimestamp ?? undefined,
          source: logData.source ?? 'firestore',
        };

        console.log('[usePaddyLiveData] Normalized data:', npkData);

        setState({
          data: npkData,
          loading: false,
          error: null,
        });
      }, (error) => {
        console.error('[usePaddyLiveData] Error:', error);
        setState({
          data: null,
          loading: false,
          error: error.message,
        });
      });

      return () => {
        console.log('[usePaddyLiveData] Unsubscribing from paddy:', paddyId);
        unsubscribe();
      };
    } catch (error: any) {
      console.error('[usePaddyLiveData] Setup error:', error);
      setState({
        data: null,
        loading: false,
        error: error.message,
      });
    }
  }, [userId, fieldId, paddyId]);

  return state;
}
