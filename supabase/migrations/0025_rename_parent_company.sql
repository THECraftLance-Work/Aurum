-- Keep the parent company display name consistent across existing environments.
update public.projects
set name = 'Sree Varaaha'
where slug = 'sri-varaha';
