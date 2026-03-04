---
title: Example SDK
layout: false
tags: docs
---

## Overview

The Example SDK enables you to integrate your applications.

{{ docsub.contact_us }} if you want to use a different version.

### Functionality

Like our other SDKs, it offers three main types of functionality:

* The {{ docsub.link_assert }} functions define test properties about your software.
* The {{ docsub.link_random }} functions request randomness from the platform.

:::note
The SDK includes several other modules that you **should never directly use in your code.**
:::

### Instrumentation

{{ docsub.long_description }}

{% include 'shared_content.md' %}

:::tip
Compile your software to run on x86-64 CPUs.
:::

### Using the SDK

The basic workflow is:

1. Include the SDK in your dependencies:

```py
python -m pip install example-sdk
```

2. Import the SDK:
```py
from example.assertions import sometimes
```

### SDK runtime behavior{id="sdk-runtime-behavior"}

Functions in the {{ docsub.link_assert }} and {{ docsub.link_lifecycle }} have 2 modes.

## Further reading

{{ collections.all | list_nav_children("Example SDK") | safe }}
