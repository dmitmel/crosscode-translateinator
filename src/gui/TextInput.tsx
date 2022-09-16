import './TextInput.scss';

import * as React from 'react';

import * as utils from '../utils';

export interface TextInputGuiProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const TextInputGui = React.forwardRef(function TextInputGui(
  rest: TextInputGuiProps,
  ref: React.Ref<HTMLInputElement>,
): React.ReactElement {
  return (
    <input
      ref={ref}
      type="text"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      autoComplete="off"
      {...rest}
    />
  );
});

export interface TextAreaGuiProps extends React.HTMLAttributes<HTMLTextAreaElement> {
  style?: React.CSSProperties;
}

// Fun fact: this component is a partial port of
// <https://github.com/uisky/notabenoid/blob/0840a9dd1932f6d254a1c9a022b77fc478afadc4/www/js/jquery.elastic.mod.js>.
// Indeed, the JQuery plugin used in Notabenoid. Also see
// <https://github.com/Andarist/react-textarea-autosize/tree/58c9807645dceb9034b733d9cb63aa66df2364b0/src>.
export class TextAreaGui extends React.Component<TextAreaGuiProps, unknown> {
  public static readonly HIDDEN_TEXT_AREA_STYLES = {
    position: 'absolute',
    top: '0',
    left: '0',
    'min-height': '0',
    'max-height': 'none',
    height: '0',
    overflow: 'hidden',
    resize: 'none',
    visibility: 'hidden',
    'z-index': '-1000',
  } as const;

  public static readonly MIMICKED_STYLES = [
    // layout
    'box-sizing',
    'width',
    'border-bottom-width',
    'border-left-width',
    'border-right-width',
    'border-top-width',
    'padding-bottom',
    'padding-left',
    'padding-right',
    'padding-top',

    // font and text
    'font-family',
    'font-size',
    'font-style',
    'font-weight',
    'letter-spacing',
    'line-height',
    'tab-size',
    'text-indent',
    'text-rendering',
    'text-transform',
    'word-wrap',
    'white-space',
  ] as const;

  public static hidden_text_area: HTMLTextAreaElement | null = null;
  public static ensure_hidden_text_area(): HTMLTextAreaElement {
    if (this.hidden_text_area == null) {
      this.hidden_text_area = document.createElement('textarea');
      this.hidden_text_area.id = utils.new_html_id();
      this.hidden_text_area.tabIndex = -1;
      this.hidden_text_area.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.hidden_text_area);
    }
    return this.hidden_text_area;
  }

  public static compute_text_area_height(real: HTMLTextAreaElement): number {
    let hidden = TextAreaGui.ensure_hidden_text_area();

    let real_style = window.getComputedStyle(real);

    for (let k of TextAreaGui.MIMICKED_STYLES) {
      hidden.style.setProperty(k, real_style.getPropertyValue(k), 'important');
    }
    for (let [k, v] of Object.entries(TextAreaGui.HIDDEN_TEXT_AREA_STYLES)) {
      hidden.style.setProperty(k, v, 'important');
    }

    let total_padding_size =
      parseFloat(real_style.paddingBottom) + parseFloat(real_style.paddingTop);
    let total_border_size =
      parseFloat(real_style.borderBottomWidth) + parseFloat(real_style.borderTopWidth);

    const ROW_MEASURING_TEXT = '\u00A0'; // non-breaking whitespace
    hidden.value = ROW_MEASURING_TEXT;
    let row_height = hidden.scrollHeight - total_padding_size;
    let min_rows = real.rows;
    // TODO: max_rows?

    hidden.value = real.value || real.placeholder || ROW_MEASURING_TEXT;
    let height = hidden.scrollHeight;
    height = Math.max(height, min_rows * row_height + total_padding_size);
    if (real_style.boxSizing === 'border-box') {
      height += total_border_size;
    } else if (real_style.boxSizing === 'content-box') {
      height -= total_padding_size;
    } else {
      // what?
    }

    return height;
  }

  public ref: HTMLTextAreaElement | null = null;

  public override componentDidMount(): void {
    utils.assert(this.ref != null);
    this.ref.addEventListener('input', this.update_size);
    window.addEventListener('resize', this.update_size);

    this.update_size();
  }

  public override componentWillUnmount(): void {
    utils.assert(this.ref != null);
    this.ref.removeEventListener('input', this.update_size);
    window.removeEventListener('resize', this.update_size);
  }

  public update_size = (): void => {
    utils.assert(this.ref != null);
    let height = TextAreaGui.compute_text_area_height(this.ref);
    this.ref.style.setProperty('height', `${height}px`, 'important');
    this.ref.style.setProperty('overflow', 'hidden', 'important');
  };

  private set_ref = (element: HTMLTextAreaElement | null): void => {
    this.ref = element;
    if (element != null) {
      this.update_size();
    }
  };

  public override render(): React.ReactNode {
    return <textarea {...this.props} ref={this.set_ref} />;
  }
}
