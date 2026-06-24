export interface Book {
  id: number
  title: string
  author?: string
  cover?: string
  total_chapters: number
  current_chapter: number
  is_active?: 0 | 1
  last_read_at?: string
}

export interface Chapter {
  idx: number
  title: string
  paragraphs: string[]
}

export interface Danmaku {
  id: number
  chapter_idx: number
  paragraph_idx: number
  sentence_idx: number
  author: string  // '小艺' / '小宝'
  content: string
  created_at: string
}

export interface Annotation {
  id: number
  chapter_idx: number
  paragraph_idx: number
  anchor_text: string
  note?: string
  color: string  // 'yellow' / 'pink' / 'green' / 'blue'
  author: string
  created_at: string
}

const BASE = ''  // 走当前域名 - 但 ebook API 在 mem.coolmbaby.top:5180? 实际 Caddy 已经 reverse_proxy /api/ebooks → 5180

export async function fetchBooks(): Promise<{books: Book[]}>{
  return fetch(`/api/ebooks`).then(r => r.json()).then(d => ({books: Array.isArray(d) ? d : (d.books || [])}))
}

export async function fetchBook(id: number): Promise<Book>{
  return fetch(`/api/ebooks/${id}`).then(r => r.json())
}

export async function fetchChapters(id: number): Promise<{chapters: {idx:number; title:string}[]}>{
  return fetch(`/api/ebooks/${id}/chapters`).then(r => r.json()).then(d => ({chapters: d.chapters || []}))
}

export async function fetchChapter(id: number, n: number): Promise<Chapter>{
  return fetch(`/api/ebooks/${id}/chapter/${n}`).then(r => r.json()).then(d => d.chapter || d)
}

export async function fetchDanmaku(bookId: number, chapter: number): Promise<{danmaku: Danmaku[]}>{
  return fetch(`/api/ebooks/${bookId}/danmaku?chapter=${chapter}`).then(r => r.json()).then(d => ({danmaku: Array.isArray(d) ? d : (d.danmaku || [])}))
}

export async function fetchAnnotations(bookId: number, chapter: number): Promise<{annotations: Annotation[]}>{
  return fetch(`/api/ebooks/${bookId}/annotations?chapter=${chapter}`).then(r => r.json()).then(d => ({annotations: Array.isArray(d) ? d : (d.annotations || [])}))
}

export async function postDanmaku(bookId: number, chapter: number, paragraph: number, sentence: number, content: string, author='小艺'){
  return fetch(`/api/ebooks/${bookId}/danmaku`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({chapter, paragraph, sentence, content, author}),
  }).then(r => r.json())
}

export async function postAnnotation(bookId: number, chapter: number, paragraph: number, anchor_text: string, note: string, color='yellow', author='小艺'){
  return fetch(`/api/ebooks/${bookId}/annotation`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({chapter, paragraph, anchor_text, note, color, author}),
  }).then(r => r.json())
}

export async function setProgress(bookId: number, chapter: number, set_active=true){
  return fetch(`/api/ebooks/${bookId}/progress`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({chapter, set_active}),
  }).then(r => r.json())
}

export async function deleteAnnotation(bookId: number, annoId: number){
  return fetch(`/api/ebooks/${bookId}/annotation/${annoId}`, {method:'DELETE'}).then(r => r.json())
}

export async function deleteDanmaku(bookId: number, did: number){
  return fetch(`/api/ebooks/${bookId}/danmaku/${did}`, {method:'DELETE'}).then(r => r.json())
}

// 召唤小宝
export async function askBao(bookId: number, chapter: number, paragraph: number, sentence: number, sentence_text: string, paragraph_text: string, prompt: string){
  return fetch(`/api/ebooks/ask`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({book_id:bookId, chapter, paragraph, sentence, sentence_text, paragraph_text, prompt}),
  }).then(r => r.json())
}
