// @vitest-environment node
import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findAsset } from '../../store/assets';
import { isPdf, linkedAssetIds } from './model';
import { SAMPLE_INCIDENTS } from './seed';

const publicFile = (url: string) => new URL(`../../../public${url}`, import.meta.url);

describe('sample incidents', () => {
  it('link only assets that exist in the synthetic grid', () => {
    SAMPLE_INCIDENTS.forEach((incident) =>
      linkedAssetIds(incident).forEach((id) => expect(findAsset(id), id).toBeDefined()),
    );
  });

  it('attach the committed sample PDFs, with their real sizes', () => {
    const samples = SAMPLE_INCIDENTS.flatMap((incident) => incident.attachments);
    expect(samples).toHaveLength(3);
    samples.forEach((attachment) => {
      expect(attachment.source).toBe('sample');
      const file = publicFile(attachment.url!);
      expect(statSync(file).size, attachment.name).toBe(attachment.size);
      expect(isPdf(readFileSync(file)), attachment.name).toBe(true);
    });
  });

  it('have unique ids', () => {
    const ids = SAMPLE_INCIDENTS.flatMap((incident) => [
      incident.id,
      ...incident.attachments.map(({ id }) => id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
