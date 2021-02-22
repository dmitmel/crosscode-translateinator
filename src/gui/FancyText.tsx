import * as utils from '../utils';
import * as Inferno from 'inferno';
import * as crosscode_markup from '../crosscode_markup';

export interface FancyTextGuiProps {
  crosscode_markup?: boolean;
  children: string;
}

export function FancyTextGui(props: utils.ComponentProps<FancyTextGuiProps>): JSX.Element {
  console.assert(props.crosscode_markup);
  let source_text = props.children;

  let elements: JSX.Element[] = [];

  let current_color: string | null | undefined = null;
  let prev_token_end_index = 0;
  for (let token of crosscode_markup.lex(source_text)) {
    if (token.start_index !== prev_token_end_index) {
      throw new Error(
        `Detected a bug in the lexer: the start index of a token (${token.start_index}) doesn't match the end index of a previous token (${prev_token_end_index})`,
      );
    }

    if (token.type === 'COLOR') {
      current_color = crosscode_markup.FONT_COLORS.get(token.data);
    }

    let token_style: CSSProperties = {};
    let token_color = token.type === 'LITERAL_TEXT' ? current_color : '#66ccdd';
    if (token_color != null) token_style.color = token_color;

    elements.push(
      <span key={`token;${token.type};${token.start_index};${token.end_index}`} style={token_style}>
        {source_text.slice(token.start_index, token.end_index)}
      </span>,
    );

    prev_token_end_index = token.end_index;
  }
  if (prev_token_end_index !== source_text.length) {
    throw new Error(
      `Detected a bug in the lexer: the end index of the last token (${prev_token_end_index}) doesn't match the length of the source text (${source_text.length})`,
    );
  }

  return <span className="FancyTextGui">{elements}</span>;
}

/// Taken from <https://stackoverflow.com/a/6234804/12005228>.
export function escape_html(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
