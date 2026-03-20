"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { imageUploadLimits, itemFormLimits, itemStatuses } from "@/lib/constants";
import type { ItemWithImages } from "@/lib/types";
import { toDateOnlyString } from "@/lib/utils";
import {
  itemFormSchema,
  type ItemFormValues,
} from "@/lib/validation";

type ItemFormProps = {
  item?: ItemWithImages | null;
};

function toDateInputValue(value: string | Date | null | undefined) {
  return toDateOnlyString(value) ?? "";
}

export function ItemForm({ item }: ItemFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      id: item?.id ?? "",
      title: item?.title ?? "",
      description: item?.description ?? "",
      category: item?.category ?? "",
      condition: item?.condition ?? "",
      purchaseDate: toDateInputValue(item?.purchaseDate),
      purchasePrice: item?.purchasePrice?.toString() ?? "",
      expectedPrice: item?.expectedPrice?.toString() ?? "",
      availableFrom: toDateInputValue(item?.availableFrom),
      locationArea: item?.locationArea ?? "",
      status: item?.status ?? "available",
    },
  });

  async function onSubmit(values: ItemFormValues) {
    setServerError(null);
    setServerMessage(null);

    startTransition(async () => {
      const formData = new FormData();
      for (const [key, value] of Object.entries(values)) {
        formData.set(key, value ?? "");
      }
      for (const imageId of removedImageIds) {
        formData.append("removeImageIds", imageId);
      }
      for (const file of selectedFiles) {
        formData.append("images", file);
      }

      const response = await fetch("/api/admin/items", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json()) as { error?: string; itemId?: string; message?: string };

      if (!response.ok) {
        setServerError(result.error ?? "Unable to save the item right now.");
        return;
      }

      setServerMessage(result.message ?? "Item saved.");
      const targetItemId = result.itemId ?? item?.id;
      if (targetItemId) {
        router.push(`/admin/items/${targetItemId}/edit`);
      } else {
        router.push("/admin");
      }
      router.refresh();
    });
  }

  function handleDelete() {
    if (!item) {
      return;
    }

    const confirmed = window.confirm("Delete this item and its stored leads?");
    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/admin/items/${item.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setServerError("Unable to delete the item.");
        return;
      }

      router.push("/admin");
      router.refresh();
    });
  }

  function markImageForRemoval(imageId: string) {
    setRemovedImageIds((current) =>
      current.includes(imageId) ? current : current.concat(imageId),
    );
  }

  function restoreImage(imageId: string) {
    setRemovedImageIds((current) => current.filter((currentId) => currentId !== imageId));
  }

  return (
    <div className="space-y-8">
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <input type="hidden" {...register("id")} value={item?.id ?? ""} />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="title">
              Title
            </label>
            <input
              className="field"
              id="title"
              maxLength={itemFormLimits.titleMax}
              minLength={itemFormLimits.titleMin}
              {...register("title")}
            />
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              {itemFormLimits.titleMin}-{itemFormLimits.titleMax} characters.
            </p>
            {errors.title ? <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.title.message}</p> : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="description">
              Description
            </label>
            <textarea
              className="textarea"
              id="description"
              maxLength={itemFormLimits.descriptionMax}
              {...register("description")}
            />
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Up to {itemFormLimits.descriptionMax} characters.
            </p>
            {errors.description ? (
              <p className="mt-2 text-sm text-[color:var(--danger)]">{errors.description.message}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="category">
              Category
            </label>
            <input
              className="field"
              id="category"
              maxLength={itemFormLimits.categoryMax}
              {...register("category")}
            />
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Up to {itemFormLimits.categoryMax} characters.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="condition">
              Condition
            </label>
            <input
              className="field"
              id="condition"
              maxLength={itemFormLimits.conditionMax}
              {...register("condition")}
            />
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Up to {itemFormLimits.conditionMax} characters.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="purchaseDate">
              Purchase date
            </label>
            <input className="field" id="purchaseDate" type="date" {...register("purchaseDate")} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="availableFrom">
              Available from
            </label>
            <input className="field" id="availableFrom" type="date" {...register("availableFrom")} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="purchasePrice">
              Purchase price
            </label>
            <input
              className="field"
              id="purchasePrice"
              inputMode="decimal"
              maxLength={itemFormLimits.bidPriceMax}
              {...register("purchasePrice")}
            />
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Up to {itemFormLimits.bidPriceMax} characters.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="expectedPrice">
              Expected price
            </label>
            <input
              className="field"
              id="expectedPrice"
              inputMode="decimal"
              maxLength={itemFormLimits.bidPriceMax}
              {...register("expectedPrice")}
            />
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Up to {itemFormLimits.bidPriceMax} characters.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="locationArea">
              Location area
            </label>
            <input
              className="field"
              id="locationArea"
              maxLength={itemFormLimits.locationAreaMax}
              {...register("locationArea")}
            />
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Up to {itemFormLimits.locationAreaMax} characters.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="status">
              Status
            </label>
            <select className="select" id="status" {...register("status")}>
              {itemStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-stone-800" htmlFor="images">
            Upload photos
          </label>
          <input
            accept="image/jpeg,image/png,image/webp"
            className="field"
            id="images"
            multiple
            onChange={(event) =>
              setSelectedFiles(event.target.files ? Array.from(event.target.files) : [])
            }
            type="file"
          />
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Upload up to {imageUploadLimits.maxFiles} JPG, PNG, or WebP images, {imageUploadLimits.maxFileSizeBytes / (1024 * 1024)} MB each.
          </p>
        </div>

        {serverError ? <p className="text-sm text-[color:var(--danger)]">{serverError}</p> : null}
        {serverMessage ? <p className="text-sm text-[color:var(--success)]">{serverMessage}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button className="button" disabled={isPending} type="submit">
            {isPending ? "Saving..." : item ? "Save changes" : "Create item"}
          </button>
          {item ? (
            <button className="button-danger" disabled={isPending} onClick={handleDelete} type="button">
              Delete item
            </button>
          ) : null}
        </div>
      </form>

      {item ? (
        <div>
          <h2 className="display-title text-3xl font-semibold text-stone-900">
            Current images
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {item.images.length > 0 ? (
              item.images.map((image) => {
                const isRemoved = removedImageIds.includes(image.id);

                return (
                <div
                  key={image.id}
                  className={`overflow-hidden rounded-[22px] border bg-white ${
                    isRemoved
                      ? "border-[color:var(--danger)] opacity-60"
                      : "border-[color:var(--line)]"
                  }`}
                >
                  <div className="relative aspect-[4/3]">
                    <Image src={image.thumbnailUrl ?? image.imageUrl} alt={item.title} fill className="object-cover" sizes="33vw" />
                  </div>
                  <div className="flex items-center justify-between gap-3 p-3">
                    <p className="text-sm text-[color:var(--muted)]">
                      {isRemoved ? "Marked for deletion" : "Stored image"}
                    </p>
                    {isRemoved ? (
                      <button className="button-secondary" onClick={() => restoreImage(image.id)} type="button">
                        Undo
                      </button>
                    ) : (
                      <button className="button-danger" onClick={() => markImageForRemoval(image.id)} type="button">
                        Remove image
                      </button>
                    )}
                  </div>
                </div>
              )})
            ) : (
              <p className="text-sm text-[color:var(--muted)]">No images uploaded yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
