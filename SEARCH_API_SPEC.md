# Search API Specification v2.0

## Overview
The Search API has been upgraded to support YouTube-style filtering, sorting, and pagination. This document provides complete integration details for frontend developers.

## 🚀 Quick Start

### Basic Usage
```javascript
const searchSegments = async (query, options = {}) => {
  const params = new URLSearchParams({
    term: query,
    ...options
  });
  
  const response = await fetch(`/search/segments?${params}`);
  return await response.json();
};

// Simple search
const results = await searchSegments('psychology');

// Advanced search
const results = await searchSegments('psychology', {
  sortBy: 'view_count',
  sortOrder: 'desc',
  page: 1,
  limit: 10
});
```

## 📋 API Endpoint

### URL
```
GET /search/segments
```

### Request Parameters

#### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `term` | `string` | Search query string |

#### Optional Parameters

| Parameter | Type | Values | Default | Description |
|-----------|------|--------|---------|-------------|
| `sortBy` | `string` | `'relevance'`, `'upload_date'`, `'view_count'` | `'relevance'` | Sort method |
| `sortOrder` | `string` | `'asc'`, `'desc'` | `'desc'` | Sort direction |
| `page` | `number` | `1` to `∞` | `1` | Page number |
| `limit` | `number` | `1` to `100` | `20` | Results per page |
| `dateFrom` | `string` | ISO date string | `null` | Filter from date |
| `dateTo` | `string` | ISO date string | `null` | Filter to date |

### Parameter Validation

```javascript
// Valid sortBy values
const SORT_OPTIONS = ['relevance', 'upload_date', 'view_count'];

// Valid sortOrder values
const SORT_ORDERS = ['asc', 'desc'];

// Date format validation
const isValidDate = (dateString) => {
  return !isNaN(Date.parse(dateString));
};
```

## 📊 Response Format

### Success Response (200 OK)

```json
{
  "segments": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "segmentId": "unique-segment-id",
      "title": "Understanding Human Psychology",
      "description": "A deep dive into psychological principles...",
      "start": 120,
      "end": 300,
      "views": 1250,
      "captions": "In this segment we explore the fundamental aspects...",
      "createdAt": "2023-06-15T10:30:00.000Z",
      "video": {
        "_id": "507f1f77bcf86cd799439012",
        "title": "Complete Psychology Course",
        "ytId": "dQw4w9WgXcQ",
        "duration": 3600,
        "youtube": {
          "snippet": {
            "title": "Complete Psychology Course",
            "description": "Full course description...",
            "publishedAt": "2023-06-01T00:00:00.000Z"
          }
        }
      },
      "tags": [
        {
          "_id": "507f1f77bcf86cd799439013",
          "name": "psychology",
          "segmentCount": 45,
          "rank": 8
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalResults": 142,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  },
  "searchParams": {
    "term": "psychology",
    "sortBy": "view_count",
    "sortOrder": "desc",
    "dateFrom": "2023-01-01",
    "dateTo": null
  }
}
```

### Error Response (400 Bad Request)

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Invalid sortBy parameter. Must be one of: relevance, upload_date, view_count"
}
```

## 🎯 Sort Modes Explained

### 1. Relevance (`sortBy: 'relevance'`)
- **Best for**: Finding most relevant content
- **Algorithm**: Text matching + recency boost
- **Field weights**: Captions (8x), Title (6x), High tags (5x), Description (4x), Mid tags (3x), Low tags (2x)
- **Recency boost**: Recent content gets higher scores, but highly relevant old content can still rank well

### 2. Upload Date (`sortBy: 'upload_date'`)
- **Best for**: Finding recent content or browsing chronologically
- **Primary sort**: `createdAt` field
- **Secondary sort**: Relevance score
- **Use cases**: "What's new", timeline browsing

### 3. View Count (`sortBy: 'view_count'`)
- **Best for**: Finding popular/trending content
- **Primary sort**: `views` field
- **Secondary sort**: Relevance score
- **Use cases**: "Most popular", trending content

## 💻 Frontend Implementation Examples

### React Hook Example

```javascript
import { useState, useEffect } from 'react';

const useSegmentSearch = () => {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchSegments = async (searchParams) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams(searchParams);
      const response = await fetch(`/search/segments?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { results, loading, error, searchSegments };
};

// Usage in component
const SearchComponent = () => {
  const { results, loading, error, searchSegments } = useSegmentSearch();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('relevance');

  const handleSearch = () => {
    searchSegments({
      term: searchTerm,
      sortBy,
      page: 1,
      limit: 20
    });
  };

  return (
    <div>
      <input 
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search segments..."
      />
      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
        <option value="relevance">Relevance</option>
        <option value="upload_date">Upload Date</option>
        <option value="view_count">View Count</option>
      </select>
      <button onClick={handleSearch}>Search</button>
      
      {loading && <div>Loading...</div>}
      {error && <div>Error: {error}</div>}
      {results && (
        <div>
          <p>Found {results.pagination.totalResults} results</p>
          {results.segments.map(segment => (
            <div key={segment._id}>
              <h3>{segment.title}</h3>
              <p>{segment.description}</p>
              <p>Views: {segment.views}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

### Vue.js Composition API Example

```javascript
import { ref, reactive } from 'vue';

export const useSegmentSearch = () => {
  const results = ref(null);
  const loading = ref(false);
  const error = ref(null);

  const searchSegments = async (searchParams) => {
    loading.value = true;
    error.value = null;
    
    try {
      const params = new URLSearchParams(searchParams);
      const response = await fetch(`/search/segments?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      results.value = data;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  return { results, loading, error, searchSegments };
};
```

### Pagination Component Example

```javascript
const PaginationComponent = ({ pagination, onPageChange }) => {
  const { page, totalPages, hasNext, hasPrev } = pagination;
  
  return (
    <div className="pagination">
      <button 
        disabled={!hasPrev}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      
      <span>{page} of {totalPages}</span>
      
      <button 
        disabled={!hasNext}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
};
```

## 📅 Date Filtering

### Date Format
Use ISO 8601 format: `YYYY-MM-DDTHH:mm:ss.sssZ`

### Examples

```javascript
// Filter last 30 days
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

searchSegments({
  term: 'psychology',
  dateFrom: thirtyDaysAgo.toISOString()
});

// Filter specific date range
searchSegments({
  term: 'psychology',
  dateFrom: '2023-01-01T00:00:00.000Z',
  dateTo: '2023-12-31T23:59:59.999Z'
});
```

### Date Helper Functions

```javascript
const DateHelpers = {
  // Get date for "last X days"
  getLastDays: (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  },
  
  // Get date for "last X months"
  getLastMonths: (months) => {
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    return date.toISOString();
  },
  
  // Get start of current year
  getYearStart: () => {
    const date = new Date();
    date.setMonth(0, 1);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }
};
```

## 🔄 Migration from v1.0

### Breaking Changes

1. **Response Format**: Results are now nested under `segments` key
2. **Pagination**: New pagination metadata included
3. **Search Parameters**: Additional optional parameters available

### Migration Examples

#### Before (v1.0)
```javascript
// Old format
const results = await fetch('/search/segments?term=psychology');
const segments = await results.json(); // Direct array

segments.forEach(segment => {
  console.log(segment.title);
});
```

#### After (v2.0)
```javascript
// New format
const results = await fetch('/search/segments?term=psychology');
const data = await results.json(); // Object with segments and metadata

data.segments.forEach(segment => {
  console.log(segment.title);
});

// Access pagination info
console.log(`Page ${data.pagination.page} of ${data.pagination.totalPages}`);
```

## 🎨 UI/UX Recommendations

### Search Interface Components

1. **Search Bar**
   - Implement debounced search (300ms delay)
   - Show search suggestions based on popular terms
   - Allow search on Enter key press

2. **Sort Controls**
   - Dropdown or radio buttons for sort options
   - Clear labels: "Relevance", "Upload Date", "View Count"
   - Remember user's preferred sort method

3. **Filters**
   - Date range picker for `dateFrom`/`dateTo`
   - Quick filter buttons: "Last 7 days", "Last month", "This year"
   - Clear indication when filters are active

4. **Results Display**
   - Show total results count
   - Display loading states
   - Implement infinite scroll or pagination
   - Show "No results" state with search suggestions

5. **Pagination**
   - Show current page and total pages
   - Implement both button and infinite scroll options
   - Allow users to jump to specific pages

### Performance Optimizations

1. **Debouncing**: Prevent API calls on every keystroke
2. **Caching**: Cache recent search results
3. **Lazy Loading**: Load additional results as needed
4. **State Management**: Preserve search state during navigation

## 🔧 TypeScript Definitions

```typescript
interface SearchParams {
  term: string;
  sortBy?: 'relevance' | 'upload_date' | 'view_count';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}

interface Segment {
  _id: string;
  segmentId: string;
  title: string;
  description?: string;
  start: number;
  end: number;
  views: number;
  captions?: string;
  createdAt: string;
  video: {
    _id: string;
    title: string;
    ytId: string;
    duration: number;
    youtube: {
      snippet: {
        title: string;
        description: string;
        publishedAt: string;
      };
    };
  };
  tags: Array<{
    _id: string;
    name: string;
    segmentCount: number;
    rank: number;
  }>;
}

interface SearchResponse {
  segments: Segment[];
  pagination: {
    page: number;
    limit: number;
    totalResults: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  searchParams: {
    term: string;
    sortBy: string;
    sortOrder: string;
    dateFrom: string | null;
    dateTo: string | null;
  };
}
```

## 🐛 Error Handling

### Common Error Scenarios

1. **Invalid Parameters**
   - Check `sortBy` values before sending
   - Validate date formats
   - Ensure `page` and `limit` are positive numbers

2. **Network Errors**
   - Implement retry logic
   - Show user-friendly error messages
   - Provide offline fallback if applicable

3. **No Results**
   - Show helpful suggestions
   - Offer to clear filters
   - Suggest alternative search terms

### Error Handling Example

```javascript
const handleSearchError = (error, searchTerm) => {
  if (error.status === 400) {
    return 'Invalid search parameters. Please check your filters.';
  } else if (error.status === 404) {
    return `No results found for "${searchTerm}". Try different keywords.`;
  } else if (error.status >= 500) {
    return 'Search service is temporarily unavailable. Please try again later.';
  } else {
    return 'An unexpected error occurred. Please try again.';
  }
};
```

## 🧪 Testing Guidelines

### Unit Tests

```javascript
// Test search parameter validation
describe('Search Parameter Validation', () => {
  test('should validate sortBy parameter', () => {
    const validSortBy = ['relevance', 'upload_date', 'view_count'];
    expect(validSortBy).toContain('relevance');
  });

  test('should validate page parameter', () => {
    expect(validatePage(1)).toBe(true);
    expect(validatePage(0)).toBe(false);
    expect(validatePage(-1)).toBe(false);
  });
});
```

### Integration Tests

```javascript
// Test API integration
describe('Search API Integration', () => {
  test('should return segments for valid search', async () => {
    const response = await searchSegments({ term: 'psychology' });
    expect(response.segments).toBeInstanceOf(Array);
    expect(response.pagination).toBeDefined();
  });

  test('should handle pagination correctly', async () => {
    const response = await searchSegments({ 
      term: 'psychology', 
      page: 2, 
      limit: 5 
    });
    expect(response.pagination.page).toBe(2);
    expect(response.pagination.limit).toBe(5);
  });
});
```

## 📈 Analytics and Tracking

### Recommended Tracking Events

```javascript
// Track search events
const trackSearchEvent = (eventType, searchParams) => {
  analytics.track(eventType, {
    search_term: searchParams.term,
    sort_by: searchParams.sortBy,
    sort_order: searchParams.sortOrder,
    page: searchParams.page,
    has_date_filter: !!(searchParams.dateFrom || searchParams.dateTo)
  });
};

// Usage examples
trackSearchEvent('search_performed', { term: 'psychology', sortBy: 'relevance' });
trackSearchEvent('sort_changed', { sortBy: 'view_count' });
trackSearchEvent('page_changed', { page: 2 });
```

## 📚 Additional Resources

- [Elasticsearch Query DSL Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html)
- [REST API Best Practices](https://restfulapi.net/resource-naming/)
- [Frontend Performance Optimization](https://web.dev/performance/)

## 🤝 Support

For questions or issues:
- Check the backend logs for detailed error information
- Verify all parameters match the specification
- Test with minimal parameters first, then add complexity
- Contact the backend team for API-specific issues

---

*This specification covers the Search API v2.0. For the most up-to-date information, always refer to the latest version of this document.* 