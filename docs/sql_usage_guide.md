# SQL Usage Guide

Telebase includes an Edge-optimized SQL query engine that allows developers to run standard SQL commands directly over encrypted JSON tables.

---

## Supported Commands

### 1. SELECT Statements
Used to retrieve data from a table.

```sql
SELECT column1, column2, COUNT(*) AS count
FROM table_name
WHERE filter_condition
GROUP BY group_columns
HAVING group_filter
ORDER BY order_expression DESC
LIMIT number;
```

#### Projections:
- Wildcard `*` retrieves all fields.
- Table-qualified wildcards are supported: `SELECT users.* FROM users`.
- Aliases: `SELECT name AS full_name FROM users`.

#### Filters (`WHERE` & `HAVING`):
Supported operators: `=`, `!=`, `<>`, `>`, `>=`, `<`, `<=`, `LIKE` (wildcard character `%` matches any sequence).

```sql
SELECT * FROM products WHERE category = 'electronics' AND price <= 500;
SELECT * FROM customers WHERE email LIKE '%@gmail.com';
```

---

### 2. INNER JOIN Statements
Combines columns from two tables based on equality values.

```sql
SELECT users.name, orders.amount 
FROM users 
INNER JOIN orders ON users.id = orders.user_id;
```
*Note: Joined queries must use fully-qualified column references (`table.column`) for ambiguous names.*

---

### 3. INSERT Statements
Appends a new record to the table. An `id` UUID and `created_at` timestamp are generated automatically if omitted.

```sql
INSERT INTO users (name, age, plan) VALUES ('John Doe', 34, 'pro');
```

---

### 4. UPDATE Statements
Updates values of records matching the filter clause.

```sql
UPDATE users SET plan = 'enterprise', age = 35 WHERE name = 'John Doe';
```

---

### 5. DELETE Statements
Deletes records matching the filter clause.

```sql
DELETE FROM users WHERE age < 18;
```

---

### 6. Indexing (CREATE/DROP INDEX)
Indexes speed up column lookups.

```sql
CREATE INDEX idx_user_email ON users (email);
DROP INDEX idx_user_email ON users;
```
Lookups on columns that have indexes use `INDEX_SCAN` strategies, bypassing slow `FULL_TABLE_SCAN` loops.
