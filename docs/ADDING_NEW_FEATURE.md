# 🚀 Hướng Dẫn: Thêm Feature Mới

Hướng dẫn step-by-step thêm feature mới vào BiBo Tools v2.

---

## 📋 Checklist Feature Bao Gồm

**Giả sử feature**: "Recipe Manager" (CRUD recipes)

### 1️⃣ Backend (API Layer)

- [ ] Mock API endpoint (`src/api/recipes.ts`)
- [ ] Zustand query hooks (fetch, create, update, delete)
- [ ] Optimistic UI setup
- [ ] Error handling + toast

### 2️⃣ Frontend (UI Layer)

- [ ] Route page (`src/routes/Recipes.tsx`)
- [ ] Sub-components (`src/components/recipes/`)
- [ ] Add to router (`App.tsx`)

### 3️⃣ Data & Validation

- [ ] Zod schema (`src/schemas/recipe.ts`)
- [ ] TypeScript types

### 4️⃣ Styling & Theme

- [ ] Use semantic tokens (primary, card, muted...)
- [ ] Responsive layout
- [ ] Dark mode compatible

### 5️⃣ Integration

- [ ] Tool registry (`src/lib/tools.ts`)
- [ ] Shortcut (`useGlobalShortcuts`)
- [ ] LocalStorage (if needed)

### 6️⃣ Testing & Polish

- [ ] Manual testing (create/read/update/delete)
- [ ] Keyboard shortcuts work
- [ ] Mobile responsive
- [ ] No console.log
- [ ] TypeScript strict mode pass
- [ ] ESLint pass

---

## 📝 Step-by-Step: Recipe Manager Example

### Step 1: Define Schema & Types

Create `src/schemas/recipe.ts`:

```ts
import { z } from 'zod';

export const RecipeSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  ingredients: z.array(z.string()),
  instructions: z.string(),
  prepTime: z.number(),        // minutes
  servings: z.number(),
  tags: z.array(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Recipe = z.infer<typeof RecipeSchema>;

export function parseRecipes(data: unknown): Recipe[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => {
      try {
        return RecipeSchema.parse(item);
      } catch {
        return null;  // Skip invalid records
      }
    })
    .filter((r): r is Recipe => !!r);
}
```

### Step 2: Create API Hooks

Create `src/api/recipes.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from './client';
import { API } from '@/lib/config';
import { parseRecipes, type Recipe } from '@/schemas/recipe';
import { optimisticList } from '@/lib/optimistic';
import { toast } from '@/components/ui/sonner';

// Query hook
async function fetchRecipes(): Promise<Recipe[]> {
  const data = await fetchJson<unknown[]>(API.RECIPES);
  return parseRecipes(data);
}

export function useRecipes() {
  return useQuery({
    queryKey: ['recipes'],
    queryFn: fetchRecipes,
  });
}

// Create mutation
export interface RecipeInput {
  title: string;
  ingredients: string[];
  instructions: string;
  prepTime: number;
  servings: number;
  tags?: string[];
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecipeInput) => {
      const now = new Date().toISOString();
      return fetchJson<Recipe>(API.RECIPES, {
        method: 'POST',
        body: JSON.stringify({
          ...input,
          createdAt: now,
          updatedAt: now,
        }),
      });
    },
    ...optimisticList<Recipe[], RecipeInput>(qc, ['recipes'], (old, input) => {
      const temp: Recipe = {
        id: 'temp_' + Date.now(),
        title: input.title,
        ingredients: input.ingredients,
        instructions: input.instructions,
        prepTime: input.prepTime,
        servings: input.servings,
        tags: input.tags ?? [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return [temp, ...old];
    }),
    onSuccess: () => {
      toast.success('Recipe added!');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to add recipe');
    },
  });
}

// Update mutation
export function useUpdateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (recipe: Recipe) => {
      return fetchJson<Recipe>(`${API.RECIPES}/${recipe.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...recipe,
          updatedAt: new Date().toISOString(),
        }),
      });
    },
    ...optimisticList<Recipe[], Recipe>(qc, ['recipes'], (old, recipe) =>
      old.map((r) =>
        r.id === recipe.id
          ? { ...recipe, updatedAt: new Date().toISOString() }
          : r
      )
    ),
    onSuccess: () => {
      toast.success('Recipe updated!');
    },
  });
}

// Delete mutation
export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return fetchJson(`${API.RECIPES}/${id}`, { method: 'DELETE' });
    },
    ...optimisticList<Recipe[], string>(qc, ['recipes'], (old, id) =>
      old.filter((r) => r.id !== id)
    ),
    onSuccess: () => {
      toast.success('Recipe deleted!');
    },
  });
}
```

### Step 3: Create Route Page

Create `src/routes/Recipes.tsx`:

```tsx
import { useState } from 'react';
import { Plus, Trash2, Edit, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRecipes, useCreateRecipe, useDeleteRecipe } from '@/api/recipes';
import { cn } from '@/lib/cn';
import type { Recipe } from '@/schemas/recipe';

export default function RecipesPage() {
  const { data: recipes, isLoading } = useRecipes();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const selected = recipes?.find((r) => r.id === selectedId);

  if (isLoading) {
    return <div className="flex h-full items-center justify-center">Loading...</div>;
  }

  return (
    <div className="flex h-full gap-4 p-4">
      {/* List */}
      <div className="w-64 flex flex-col gap-2 border-r border-border pr-4">
        <h2 className="text-lg font-bold">Recipes</h2>
        <Button
          onClick={() => {
            setShowForm(true);
            setSelectedId(null);
          }}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Recipe
        </Button>
        <div className="space-y-1">
          {recipes?.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={cn(
                'w-full text-left px-2 py-1 rounded transition-colors',
                selectedId === r.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              {r.title}
            </button>
          ))}
        </div>
      </div>

      {/* Detail / Form */}
      <div className="flex-1">
        {showForm ? (
          <RecipeForm
            recipe={selected}
            onClose={() => {
              setShowForm(false);
              setSelectedId(null);
            }}
          />
        ) : selected ? (
          <RecipeDetail
            recipe={selected}
            onEdit={() => setShowForm(true)}
          />
        ) : (
          <div className="flex items-center justify-center text-muted-foreground">
            Select or create a recipe
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-component: Recipe Detail View
function RecipeDetail({ recipe, onEdit }: { recipe: Recipe; onEdit: () => void }) {
  const delete_ = useDeleteRecipe();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold">{recipe.title}</h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => delete_.mutate(recipe.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{recipe.prepTime} min</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>{recipe.servings} servings</span>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Ingredients</h2>
        <ul className="space-y-1">
          {recipe.ingredients.map((ing, i) => (
            <li key={i} className="text-sm">
              • {ing}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Instructions</h2>
        <p className="whitespace-pre-wrap text-sm">{recipe.instructions}</p>
      </div>

      {recipe.tags && recipe.tags.length > 0 && (
        <div>
          <h2 className="font-semibold mb-2">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-1 text-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component: Recipe Form
function RecipeForm({
  recipe,
  onClose,
}: {
  recipe?: Recipe;
  onClose: () => void;
}) {
  const create = useCreateRecipe();
  const [title, setTitle] = useState(recipe?.title ?? '');
  const [prepTime, setPrepTime] = useState(recipe?.prepTime ?? 30);

  const handleSubmit = () => {
    if (!title.trim()) return;
    create.mutate({
      title,
      ingredients: recipe?.ingredients ?? [],
      instructions: recipe?.instructions ?? '',
      prepTime,
      servings: recipe?.servings ?? 4,
      tags: recipe?.tags,
    });
    onClose();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        {recipe ? 'Edit Recipe' : 'New Recipe'}
      </h2>
      <div>
        <label className="text-sm font-medium">Title</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Recipe name"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Prep Time (minutes)</label>
        <Input
          type="number"
          value={prepTime}
          onChange={(e) => setPrepTime(Number(e.target.value))}
        />
      </div>
      <div className="flex gap-2 pt-4">
        <Button onClick={handleSubmit} disabled={create.isPending}>
          {create.isPending ? '...' : 'Save'}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
```

### Step 4: Add Route to App

Edit `src/App.tsx`:

```ts
const Recipes = lazy(() => import('./routes/Recipes'));

<Routes>
  {/* ... existing routes ... */}
  <Route path="/recipes" element={<Recipes />} />
</Routes>
```

### Step 5: Register Tool

Edit `src/lib/tools.ts`:

```ts
export const TOOLS = [
  // ... existing ...
  {
    id: 'recipes',
    label: 'Recipes',
    icon: 'ChefHat',      // lucide-react icon name
    shortcut: 'alt+r',
    route: '/recipes',
    category: 'Productivity',
  },
];
```

### Step 6: Setup LocalStorage (Optional)

```ts
// hooks/useRecipeFilters.ts
import { useLocalStorage } from '@/hooks/useLocalStorage';

export function useRecipeFilters() {
  const [selectedTag, setSelectedTag] = useLocalStorage('recipe-tag', 'all');
  const [sortBy, setSortBy] = useLocalStorage('recipe-sort', 'title');
  return { selectedTag, setSelectedTag, sortBy, setSortBy };
}
```

---

## ✅ Testing Checklist

After implementing feature:

```
[ ] Create new item (POST)
[ ] Read items (GET list)
[ ] Update item (PUT)
[ ] Delete item (DELETE)
[ ] Optimistic UI: item appears immediately after create
[ ] Error handling: show toast on API fail
[ ] Keyboard shortcut: Alt+R opens page
[ ] Mobile responsive: flex layout on small screen
[ ] Dark theme: all colors use tokens
[ ] TypeScript strict: `npm run build` passes
[ ] No console.log: check DevTools
[ ] beforeunload warning: appears when editing + unsaved
```

---

## 🔧 Common Issues & Solutions

### Issue: "Module not found: @/api/recipes"

**Fix**: Make sure file exists and TypeScript path alias `@/*` points to `src/`

```ts
// tsconfig.app.json
"paths": {
  "@/*": ["./src/*"]
}
```

### Issue: Query cache not updating after mutation

**Fix**: Use `invalidateQueries` or `optimisticList` helper

```ts
// ❌ WRONG
mutationFn: async (input) => {
  const result = await fetchJson(API.RECIPES, { method: 'POST', body: ... });
  // Forgot to invalidate cache!
  return result;
}

// ✅ RIGHT
...optimisticList(qc, ['recipes'], updater)
```

### Issue: Component re-renders too often

**Fix**: Use selector to only re-render when specific slice changes

```ts
// ❌ Subscribes to entire store
const store = useModalStore();

// ✅ Only re-renders when current changes
const current = useModalStore((s) => s.current);
```

### Issue: Focus ring not visible

**Fix**: Use proper Tailwind focus ring classes

```tsx
// ✅ Accessible focus
<button className="focus:outline-none focus:ring-2 focus:ring-ring">
  Click me
</button>
```