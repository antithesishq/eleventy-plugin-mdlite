---
title: Home
layout: false
---

# Welcome

This is the home page.

{{ snippet }}

{{ docsub.contact_us }}

{{ unknown_var }}

{{ snippet | fake_filter }}

{% include 'shared_content.md' %}

{% highlight js %}const x = 1;{% endhighlight %}

{% pic "/image.png" %}

Below is a fenced code block with Liquid-like syntax that must be preserved:

{% raw %}
```yaml
password: ${{ secrets.GH_PAT }}
```

```cpp
SOMETIMES(x > 0, "positive input", {{"input", x}});
```
{% endraw %}
