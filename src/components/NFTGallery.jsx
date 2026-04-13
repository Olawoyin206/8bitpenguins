import { useEffect, useMemo } from 'react'
import Button from './Button.jsx'

export function TokenGalleryCard({
  tokenId,
  image = '',
  embedUrl = '',
  imageAlt = '',
  loading = false,
  error = '',
  className = '',
  lines = [],
  actionLabel = '',
  actionHref = '',
  actionOnClick,
  onCardClick,
  onImageClick,
  imageTitle = '',
  topRightControl = null,
}) {
  const handleCardClick = () => {
    if (typeof onCardClick === 'function') onCardClick()
  }

  const handleCardKeyDown = (event) => {
    if (typeof onCardClick !== 'function') return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onCardClick()
    }
  }

  const handleImageClick = (event) => {
    if (typeof onImageClick === 'function') {
      event.stopPropagation()
      onImageClick()
    }
  }

  const handleImageKeyDown = (event) => {
    if (typeof onImageClick !== 'function') return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      onImageClick()
    }
  }

  const handleActionClick = (event) => {
    event.stopPropagation()
    if (typeof actionOnClick === 'function') actionOnClick(event)
  }

  const handleTopRightControlClick = (event) => {
    event.stopPropagation()
    if (typeof topRightControl?.onClick === 'function') {
      topRightControl.onClick(event)
    }
  }

  const cardProps = typeof onCardClick === 'function'
    ? {
        onClick: handleCardClick,
        onKeyDown: handleCardKeyDown,
        role: 'button',
        tabIndex: 0,
      }
    : {}

  return (
    <div className={`mint-gallery-item ${className}`.trim()} {...cardProps}>
      <div
        className="mint-gallery-image"
        onClick={typeof onImageClick === 'function' ? handleImageClick : undefined}
        onKeyDown={typeof onImageClick === 'function' ? handleImageKeyDown : undefined}
        role={typeof onImageClick === 'function' ? 'button' : undefined}
        tabIndex={typeof onImageClick === 'function' ? 0 : undefined}
        aria-label={typeof onImageClick === 'function' ? (imageTitle || `Open traits for token ${tokenId}`) : undefined}
        style={typeof onImageClick === 'function' ? { cursor: 'pointer' } : undefined}
        title={imageTitle}
      >
        {topRightControl ? (
          <Button
            className="mint-gallery-corner-toggle"
            variant="ghost"
            size="icon"
            title={topRightControl.title || ''}
            aria-label={topRightControl.ariaLabel || topRightControl.title || ''}
            onClick={handleTopRightControlClick}
            disabled={Boolean(topRightControl.disabled)}
          >
            {topRightControl.label}
          </Button>
        ) : null}
        {embedUrl ? (
          <iframe
            className="mint-gallery-embed"
            src={embedUrl}
            title={`NFT #${tokenId} interactive preview`}
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts"
          />
        ) : image ? (
          <img
            src={image}
            alt={imageAlt || `NFT #${tokenId}`}
            loading="lazy"
            decoding="async"
          />
        ) : error ? (
          <div className="mint-loading">{error}</div>
        ) : (
          <div className="mint-loading">{loading ? 'Loading...' : 'No image'}</div>
        )}
      </div>
      <div className="mint-gallery-info">
        {lines.map((line, index) => (
          line ? <span key={`${tokenId}-line-${index}`} className="mint-gallery-id">{line}</span> : null
        ))}
        {actionLabel && actionHref ? (
          <div className="mint-gallery-actions">
            <a
              href={actionHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mint-evolve-btn"
              onClick={handleActionClick}
            >
              {actionLabel}
            </a>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function PaginatedGallery({
  items,
  currentPage,
  setPage,
  itemsPerPage = 10,
  isLoading = false,
  loadingText = 'Loading NFTs...',
  emptyText = 'No NFTs found',
  renderItem,
}) {
  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage))

  useEffect(() => {
    if (currentPage > totalPages) {
      setPage(totalPages)
    }
  }, [currentPage, totalPages, setPage])

  const paginatedItems = useMemo(
    () => items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [items, currentPage, itemsPerPage]
  )

  if (isLoading && items.length === 0) return <div className="mint-empty">{loadingText}</div>
  if (items.length === 0) return <div className="mint-empty">{emptyText}</div>

  return (
    <>
      <div className="mint-gallery-grid">
        {paginatedItems.map((item, index) => renderItem(item, index))}
      </div>
      {totalPages > 1 && (
        <div className="mint-pagination">
          <Button
            className="mint-page-btn"
            variant="secondary"
            size="sm"
            onClick={() => setPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
          >
            Prev
          </Button>
          <span className="mint-page-info">{currentPage} / {totalPages}</span>
          <Button
            className="mint-page-btn"
            variant="secondary"
            size="sm"
            onClick={() => setPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </>
  )
}
