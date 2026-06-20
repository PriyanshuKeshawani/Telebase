# NoSQL Usage Guide

Telebase supports native JSON query filters using a MongoDB-style selector object model. This is particularly useful for programmatic API query generations.

---

## Query Selector Structure

Query filters are structured as nested field-operator key-value maps.

```json
{
  "field": { "$operator": "value" }
}
```

If the operator is omitted, an exact matches check (`$eq`) is assumed:
```json
{
  "status": "active"
}
```

---

## Supported Operators

### 1. Equality (`$eq`)
Matches values that are equal to a specified value.
```json
{
  "plan": { "$eq": "pro" }
}
```

### 2. Inequality (`$ne`)
Matches all values that are not equal to the specified value.
```json
{
  "role": { "$ne": "admin" }
}
```

### 3. Comparison (`$gt`, `$gte`, `$lt`, `$lte`)
Matches numbers/dates based on order comparison:
- `$gt`: Greater than
- `$gte`: Greater than or equal to
- `$lt`: Less than
- `$lte`: Less than or equal to

```json
{
  "age": { "$gte": 21, "$lt": 65 }
}
```

### 4. Regular Expressions (`$regex`)
Performs case-insensitive regex pattern evaluation.
```json
{
  "email": { "$regex": "@company\\.com$" }
}
```

---

## Multi-Field Logical AND

You can combine filters across multiple fields inside a single query object. All conditions must be met for a record to match:

```json
{
  "plan": "pro",
  "age": { "$gte": 18 },
  "is_active": true
}
```
