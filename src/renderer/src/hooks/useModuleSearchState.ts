import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useModuleSearchState(moduleKey: string, defaultFilter = 'ALL') {
  const [searchParams, setSearchParams] = useSearchParams()

  const getInitialValue = (key: string, fallback: string) => {
    const urlVal = searchParams.get(key)
    if (urlVal !== null) return urlVal
    try {
      return sessionStorage.getItem(`search_${moduleKey}_${key}`) || fallback
    } catch {
      return fallback
    }
  }

  const [query, setQuery] = useState(() => getInitialValue('search', ''))
  const [debouncedQuery, setDebouncedQuery] = useState(() => getInitialValue('search', ''))
  const [filter, setFilter] = useState(() => getInitialValue('filter', defaultFilter))
  const [page, setPage] = useState(() => Number(getInitialValue('page', '1')) || 1)

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)
    return () => clearTimeout(handler)
  }, [query])

  // Sync to URL search params & sessionStorage
  useEffect(() => {
    const params: Record<string, string> = {}
    if (debouncedQuery.trim()) {
      params.search = debouncedQuery.trim()
      sessionStorage.setItem(`search_${moduleKey}_search`, debouncedQuery.trim())
    } else {
      sessionStorage.removeItem(`search_${moduleKey}_search`)
    }

    if (filter && filter !== defaultFilter) {
      params.filter = filter
      sessionStorage.setItem(`search_${moduleKey}_filter`, filter)
    } else {
      sessionStorage.removeItem(`search_${moduleKey}_filter`)
    }

    if (page > 1) {
      params.page = String(page)
      sessionStorage.setItem(`search_${moduleKey}_page`, String(page))
    } else {
      sessionStorage.removeItem(`search_${moduleKey}_page`)
    }

    setSearchParams(params, { replace: true })
  }, [moduleKey, debouncedQuery, filter, page, defaultFilter])

  const clearSearch = () => {
    setQuery('')
    setDebouncedQuery('')
    setPage(1)
    sessionStorage.removeItem(`search_${moduleKey}_search`)
    sessionStorage.removeItem(`search_${moduleKey}_page`)
  }

  return {
    query,
    setQuery,
    debouncedQuery,
    setDebouncedQuery,
    filter,
    setFilter,
    page,
    setPage,
    clearSearch
  }
}
