import { z } from "zod";

export const turfGetDatasetInputSchema = z.object({
  dataset_id: z.string().min(1).describe("A dataset_id returned by a prior Turf tool call."),
});
