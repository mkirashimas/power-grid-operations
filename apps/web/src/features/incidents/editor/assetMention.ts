import type { Asset } from '@pgo/grid-model';
import Mention, { type MentionNodeAttrs } from '@tiptap/extension-mention';
import type { SuggestionProps } from '@tiptap/suggestion';
import { getAssets } from '../../../store/assets';
import { suggestAssets } from './suggestions';

export type AssetSuggestion = SuggestionProps<Asset, MentionNodeAttrs>;

/**
 * Connects Tiptap's suggestion plugin to React: the plugin reports its state, and the
 * component renders the list (an MUI popper) and handles its keys.
 */
export interface MentionBridge {
  onChange: (suggestion: AssetSuggestion | null) => void;
  /** True when the list handled the key (arrows, Enter, Escape). */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/**
 * `@` mentions of grid assets. A mention stores the asset id and its name, and renders as
 * `<span data-type="mention" data-id="…">@name</span>`.
 */
export const createAssetMention = (bridge: MentionBridge) =>
  Mention.configure({
    HTMLAttributes: { class: 'asset-mention' },
    suggestion: {
      char: '@',
      items: ({ query }) => suggestAssets(getAssets(), query),
      render: () => ({
        onStart: (props) => bridge.onChange(props),
        onUpdate: (props) => bridge.onChange(props),
        onKeyDown: ({ event }) => bridge.onKeyDown(event),
        onExit: () => bridge.onChange(null),
      }),
    },
  });

/** The mention to insert for an asset. */
export const mentionAttrs = (asset: Asset): MentionNodeAttrs => ({
  id: asset.id,
  label: asset.name,
});
