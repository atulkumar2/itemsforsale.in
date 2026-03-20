"use client";

import Image from "next/image";
import { useState } from "react";

import type { ItemWithImages } from "@/lib/types";

type ItemGalleryProps = {
  item: ItemWithImages;
};

export function ItemGallery({ item }: ItemGalleryProps) {
  const [activeImageUrl, setActiveImageUrl] = useState(
    item.images[0]?.imageUrl ?? "/placeholder-chair.svg",
  );

  if (item.images.length === 0) {
    return (
      <div className="panel overflow-hidden">
        <div className="relative aspect-[4/3] w-full bg-[rgba(216,185,143,0.18)]">
          <Image
            src="/placeholder-chair.svg"
            alt={item.title}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 60vw"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="relative aspect-[4/3] w-full bg-[rgba(216,185,143,0.18)]">
        <Image
          src={activeImageUrl}
          alt={item.title}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 60vw"
        />
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-3 md:p-6">
        {item.images.map((image) => {
          const thumbnailUrl = image.thumbnailUrl ?? image.imageUrl;
          const isActive = image.imageUrl === activeImageUrl;

          return (
            <button
              key={image.id}
              className={`relative aspect-[4/3] overflow-hidden rounded-[22px] border ${
                isActive
                  ? "border-[color:var(--primary)]"
                  : "border-[color:var(--line)]"
              } bg-[rgba(216,185,143,0.16)]`}
              onClick={() => setActiveImageUrl(image.imageUrl)}
              type="button"
            >
              <Image
                src={thumbnailUrl}
                alt={`${item.title} thumbnail`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 30vw, 10vw"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
