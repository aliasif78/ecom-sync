// Constants
import { EPlatform } from '../globalConstants';
import { MockAdapter } from './mock';
import { InventoryAdapter } from '@/types';

export function getAdapter(platform: EPlatform, config: Record<string, unknown>): InventoryAdapter {
  // We only have the mock set up right now so just return the mock adapter in all cases
  return new MockAdapter(config);
}
