import { NativeModules } from 'react-native';
import { SignalData, ConnectionData, NetworkType, Carrier } from '../../../types/signal';

const { SignalModule } = NativeModules;

export interface RawSignalReading {
  carrier: Carrier;
  networkType: NetworkType;
  signal: SignalData;
  connection: ConnectionData;
}

export async function readSignal(): Promise<RawSignalReading> {
  try {
    const raw = await SignalModule.getSignalInfo();
    return {
      carrier: normalizeCarrier(raw.carrier || 'Unknown'),
      networkType: normalizeNetworkType(raw.networkType),
      signal: {
        dbm: raw.dbm ?? -999,
        rssi: raw.rssi,
        snr: raw.snr,
        cellId: raw.cellId,
        bandFrequency: raw.bandFrequency,
      },
      connection: {
        isWifi: raw.isWifi ?? false,
        downloadSpeed: raw.downloadSpeed,
        uploadSpeed: raw.uploadSpeed,
        ping: raw.ping,
      },
    };
  } catch (error) {
    console.warn('Failed to read signal:', error);
    return {
      carrier: 'Unknown' as Carrier,
      networkType: 'none',
      signal: { dbm: -999 },
      connection: { isWifi: false },
    };
  }
}

function normalizeCarrier(raw: string): string {
  const carrierMap: Record<string, string> = {
    'SMART': 'Smart',
    'smart': 'Smart',
    'Smart Communications': 'Smart',
    'GLOBE': 'Globe',
    'globe': 'Globe',
    'Globe Telecom': 'Globe',
    'TNT': 'TNT',
    'Talk N Text': 'TNT',
    'GOMO': 'GOMO',
    'SUN': 'Sun',
    'sun': 'Sun',
    'Sun Cellular': 'Sun',
    'DITO': 'DITO',
    'Dito': 'DITO',
  };
  return carrierMap[raw] || raw;
}

function normalizeNetworkType(raw: string | number): NetworkType {
  const typeMap: Record<string, NetworkType> = {
    GPRS: '2G',
    EDGE: '2G',
    CDMA: '2G',
    '1xRTT': '2G',
    IDEN: '2G',
    UMTS: '3G',
    EVDO_0: '3G',
    EVDO_A: '3G',
    HSDPA: '3G',
    HSUPA: '3G',
    HSPA: '3G',
    EVDO_B: '3G',
    EHRPD: '3G',
    HSPAP: '3G',
    LTE: '4G',
    NR: '5G',
    '2G': '2G',
    '3G': '3G',
    '4G': '4G',
    '5G': '5G',
  };
  return typeMap[String(raw)] || 'none';
}
