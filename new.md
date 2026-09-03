# Fix Missing PAN and Aadhaar Columns

Run the following SQL in the Supabase SQL Editor for project:

```text
qfcbrwxdcovxuhendwjb
```

```sql
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS pan_number text;

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS aadhaar_number text;

NOTIFY pgrst, 'reload schema';
```

## Verify the Columns

Run this query in the same Supabase project:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'customers'
  AND column_name IN ('pan_number', 'aadhaar_number');
```

The result must contain:

```text
pan_number
```

The application connects to:

```text
https://qfcbrwxdcovxuhendwjb.supabase.co
```

After the columns appear, restart the application:

```bash
npm run dev
```
