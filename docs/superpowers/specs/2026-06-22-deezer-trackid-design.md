# Deezer Track ID Resolution Design

## Goal

Populate `deezerTrackId` for every song in `prisma/seed-data/songs.json` so preview lookup always resolves to the intended Deezer track without search-time ambiguity.

## Scope

This work covers:

- Resolving missing `deezerTrackId` values for every seeded song
- Writing the resolved IDs back into `prisma/seed-data/songs.json`
- Supporting manual confirmation only when automatic resolution is not unique
- Re-seeding the Supabase development database after the seed file is updated

This work does not cover:

- Changing frontend display behavior
- Adding jacket image URLs to the API response
- Migrating track resolution away from Deezer

## Approach

Use a dedicated resolution script as the source of truth for filling `deezerTrackId`.

The script will:

1. Load `prisma/seed-data/songs.json`
2. Skip songs that already have `deezerTrackId`
3. Resolve only songs without a track ID
4. Query Deezer using the strongest available title input in this order:
   - `deezerSearchTitle`
   - `titleJa`
   - `title`
5. Narrow candidates using existing artist metadata
6. Write confirmed `deezerTrackId` values back into `songs.json`
7. Stop and ask for human confirmation when the result is not uniquely determined

## Resolution Rules

Candidate resolution is deterministic and ordered:

1. Prefer exact `deezerArtistId` matches
2. Then prefer normalized `deezerArtistName` matches
3. Then prefer normalized title matches
4. If exactly one candidate remains, accept it automatically
5. If zero candidates remain, stop and request confirmation
6. If multiple candidates remain, stop and request confirmation

Normalization follows the existing preview matching behavior:

- Unicode normalized with `NFKC`
- Lowercased
- Non-letter and non-number characters stripped

## Human Confirmation Flow

When automatic resolution fails, the script stops on that song and prints:

- `song id`
- current seed title
- candidate `trackId`
- candidate `title`
- candidate `artist`
- candidate `album`

The user then provides the correct track. That answer is stored in a local mapping file so reruns do not stop on the same song again.

## Data Outputs

### Seed Data

`prisma/seed-data/songs.json` remains the source of truth and receives the final `deezerTrackId` values.

### Confirmation Cache

Add a small local mapping file for manual overrides used by the resolver script. This file is version-controlled so future reruns are deterministic.

## Verification

Verification has four layers:

1. Unit tests for resolver behavior
   - unique candidate resolves automatically
   - zero candidates triggers confirmation state
   - multiple candidates triggers confirmation state
   - confirmed manual mapping is reused on rerun
2. Writeback test for updating seed JSON safely
3. `npm run typecheck`
4. `npm run db:seed` followed by direct database reads for representative songs

## Failure Handling

If Deezer returns no usable result or multiple usable results for a song:

- do not guess
- do not partially write that song
- print the unresolved context
- wait for user confirmation

If the script is interrupted after resolving earlier songs, already written `deezerTrackId` values remain valid and the rerun continues from the remaining unresolved songs.

## Implementation Notes

- Keep the resolver separate from the request-time preview lookup code
- Reuse the existing matching concepts so title normalization stays consistent
- Prefer writing the final resolved IDs into seed data rather than mutating only the database
- Keep the script idempotent so repeated execution is safe
