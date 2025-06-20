# Overview

This module's main feature is supporting Mnemospheres as a native feature of the Fabula Module.

Mnemospheres are treasure items that may contain skills, class features or spells.
Mnemospheres can be equipped, which will grant the player the associated skills, class features, and spells until the Mnemosphere in un-equipped.

# Basic Structure

All data in the Mnemosphere's are stored relationally within the tables found in `relation.ts`.

That file describes the relationships between Mnemosphere and the other concepts found in both Foundry and the Fabula Ultima system.

# Items

A Mnemosphere is identified by a treasure item that has a summary that starts with "Mnemosphere".

Whenever an item is created or modified, if that item is a Mnemosphere then the relational data for Mnemospheres are updated.

Each skill and class feature are stored within the item description of the Mnemosphere.

In addition, a rollable table may be stored to indicate a random source when obtaining new skills (See `Gacha.md`).