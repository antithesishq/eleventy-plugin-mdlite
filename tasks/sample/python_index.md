---
layout: layout-doc.html
title: Python SDK
htmlPageTitle: Python SDK for Antithesis
eleventyNavigation:
  key: Python
  title: Python
  parent: SDK reference
  order: 7
  prev: false
---

## Overview

The Antithesis Python SDK enables you to integrate your Python applications with Antithesis and is available on Github [here](https://github.com/antithesishq/antithesis-sdk-python/).

The Antithesis Python SDK is intended for use with Python 3.9.0 or higher. {{ docsub.contact_us }} if you want to use a different version. 


### Functionality

Like our other SDKs, the Antithesis Python SDK offers three main types of functionality:

* The {{ docsub.python_assertions_module }} allows you to define [test properties](/docs/properties_assertions/properties/) about your software or test template.
* The {{ docsub.python_random_module }} functions request structured and unstructured randomness from the Antithesis Platform.
* The {{ docsub.python_lifecycle_module }} functions inform the Antithesis Environment that particular test phases or milestones have been reached.

:::note
The SDK includes several other modules that you **should never directly use in your code.** Modules with names beginning with `_` are internal tooling for the SDK. 
:::

### Instrumentation

The Antithesis Platform includes an instrumentor package that, in the case of Python, handles *assertion cataloging* but not *coverage instrumentation*, please see [Instrumentation](/docs/instrumentation/) for a more detailed explanation of the difference. 

{{ docsub.antithesis_instrumentor }}

{% include 'container_driven_instrumentation.md' %}

Antithesis will recursively provide [*assertion cataloging*](/docs/instrumentation/) for all `.py` files in this directory. 

:::note
The instrumentor will, by default, act upon every language it supports in the cataloging directory: ([Java ](/docs/using_antithesis/sdk/java/instrumentation/), [Python](/docs/using_antithesis/sdk/python/), [JavaScript](/docs/using_antithesis/sdk/javascript_sdk/), [.NET](/docs/using_antithesis/sdk/dotnet/instrumentation/)), not just Python. 
:::

We'll also be releasing a Python instrumentor, a command-line tool which will provide [*coverage instrumentation*](/docs/instrumentation/) for Python code. You can read more about the uses of coverage instrumentation [here](/docs/instrumentation/). {{ docsub.contact_us }} if you'd like to be notified when this happens. 

### Using the SDK

The basic workflow for using the Antithesis Python SDK is:

1. Include the SDK in your dependencies:

```py
  python -m pip install antithesis
```

2. Import the SDK into each python module that uses specific SDK functions:
```py  
  from antithesis.assertions import sometimes
```
3. Call SDK functions from your code - for example:
   
```py
sometimes(
   x1 > x2, 
   "x1 is larger than x2 at some point", 
   {"x1": x1, "x2": x2, "y1": y1, "y2": y2}
  )
```

4. Run your Python project. For example, run `python -m myapp`. 

5. Deploy your build into production, or into Antithesis to test.

### SDK runtime behavior{id="sdk-runtime-behavior"}

When your code is run outside Antithesis, our SDK has sensible fallback behavior with minimal performance overhead.
This enables you to have a single build of your software that runs both inside and outside Antithesis. 

Functions in the {{ docsub.python_assertions_module }} and {{ docsub.python_lifecycle_module }} have 2 modes for **local execution**:

1. **Default**, where `assert` and `lifecycle` use local implementations of Antithesis functionality. However, the results will not be logged anywhere because no logfile has been specified.

   This mode is the default behavior, called when you run, for instance: `python -m myapp`. 
  
2.  **Default with logging**, which is the same as the above but logs output locally in [a structured JSON format](/docs/using_antithesis/sdk/fallback/schema).
   
    This mode is selected at runtime by setting the environment variable `ANTITHESIS_SDK_LOCAL_OUTPUT` at program startup.
    This variable must be set to a filepath: a logfile will be created at this location. The file must be located inside an already-existing directory. You may supply either a relative or absolute path.For instance, set `ANTITHESIS_SDK_LOCAL_OUTPUT=assertions_20240520.json python -m myapp` for the example above.


Functions in the {{ docsub.python_random_module }} module always fall back upon the [random.getrandbits(64)](https://docs.python.org/3/library/random.html#random.getrandbits) function for entropy when run outside of Antithesis.


## Further reading

{{ collections.docs | list_nav_children("Python") | safe }}
