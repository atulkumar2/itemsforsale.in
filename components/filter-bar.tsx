type FilterBarProps = {
  categories: string[];
  initialCategory: string;
  initialQuery: string;
  initialStatus: string;
};

export function FilterBar({
  categories,
  initialCategory,
  initialQuery,
  initialStatus,
}: FilterBarProps) {
  return (
    <form className="grid gap-4 lg:grid-cols-[1.6fr_1fr_1fr_auto]">
      <div>
        <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="q">
          Search title
        </label>
        <input
          className="field"
          defaultValue={initialQuery}
          id="q"
          name="q"
          placeholder="Search sofa, chair, dining table..."
          type="search"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="status">
          Status
        </label>
        <select className="select" defaultValue={initialStatus} id="status" name="status">
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="sold">Sold</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="category">
          Category
        </label>
        <select className="select" defaultValue={initialCategory} id="category" name="category">
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-3">
        <button className="button w-full lg:w-auto" type="submit">
          Apply
        </button>
      </div>
    </form>
  );
}