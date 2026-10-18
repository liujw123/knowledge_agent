import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/common'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true
})

// Turn [1] into an interactive citation button, but only in normal inline text.
md.inline.ruler.before('link', 'citation', (state, silent) => {
  const start = state.pos
  if (state.src.charCodeAt(start) !== 0x5b) return false

  const match = /^\[(\d{1,3})\]/.exec(state.src.slice(start))
  if (!match) return false

  if (!silent) {
    const token = state.push('citation', 'sup', 0)
    token.content = match[1]
    token.meta = { citation: Number(match[1]) }
  }

  state.pos += match[0].length
  return true
})

md.renderer.rules.citation = (tokens, index) => {
  const citation = tokens[index].meta.citation
  return `<sup class="citation-wrap"><button type="button" class="citation" data-citation="${citation}" title="查看引用 ${citation}">${citation}</button></sup>`
}

md.renderer.rules.fence = (tokens, index) => {
  const token = tokens[index]
  const language = (token.info || '').trim().split(/\s+/)[0]
  const label = language || 'text'
  let highlighted

  if (language && hljs.getLanguage(language)) {
    highlighted = hljs.highlight(token.content, {
      language,
      ignoreIllegals: true
    }).value
  } else {
    highlighted = md.utils.escapeHtml(token.content)
  }

  return `<div class="code-block">
    <div class="code-head">
      <span>${md.utils.escapeHtml(label)}</span>
      <button type="button" class="copy-code" aria-label="复制代码">复制</button>
    </div>
    <pre class="hljs"><code>${highlighted}</code></pre>
  </div>`
}

const defaultLinkOpen =
  md.renderer.rules.link_open ||
  ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options))

md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  tokens[index].attrSet('target', '_blank')
  tokens[index].attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen(tokens, index, options, env, self)
}

export function renderMarkdown(content) {
  return DOMPurify.sanitize(md.render(content || ''), {
    ADD_ATTR: ['target', 'rel']
  })
}
