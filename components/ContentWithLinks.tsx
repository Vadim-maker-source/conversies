'use client'

import { useState } from 'react'

interface ContentWithLinksProps {
  content: string
  maxLength?: number
}

export default function ContentWithLinks({ content, maxLength = 500 }: ContentWithLinksProps) {
  const [expanded, setExpanded] = useState(false)
  
  // Функция для безопасного рендеринга HTML с ссылками
  const renderContent = (text: string) => {
    // Безопасный рендеринг, избегая XSS
    const createMarkup = () => {
      // Оставляем только теги ссылок
      const sanitized = text.replace(/<a\s[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/gi, 
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$2</a>'
      )
      
      // Удаляем все другие HTML теги
      const clean = sanitized.replace(/<\/?[^>]+(>|$)/g, '')
      
      // Находим ссылки в тексте и оборачиваем их
      const withLinks = clean.replace(
        /(https?:\/\/[^\s]+)/g, 
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>'
      )
      
      return { __html: withLinks }
    }

    return <div dangerouslySetInnerHTML={createMarkup()} />
  }

  const displayContent = expanded || content.length <= maxLength 
    ? content 
    : content.substring(0, maxLength) + '...'

  return (
    <div className="text-gray-700">
      {renderContent(displayContent)}
      
      {content.length > maxLength && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-2"
        >
          {expanded ? 'Свернуть' : 'Читать дальше'}
        </button>
      )}
    </div>
  )
}