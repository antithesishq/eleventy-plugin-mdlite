#### Example cataloging directory:
```bash{.enumerated}
> ln -s /usr/share/my_app /opt/antithesis/catalog 

> ls -lAh /opt/antithesis/catalog
lrwxrwxrwx  1 me users 4 Apr  8 17:32 /opt/antithesis/catalog -> /usr/share/my_app

> ls -lAh /opt/antithesis/catalog/
-rwxr-xr-x  1 me users  20K Apr  8 17:33 dotnet_file.dll
lrwxrwxrwx  1 me users 27 Apr  8 17:52 more_files -> /opt/my_project/java_files 
-rwxr-xr-x  1 me users  10K Apr  8 17:33 python_script.py

> ls -lA /opt/antithesis/catalog/more_files/
-rw-r--r--  1 me users  16K Apr  8 17:51 main.jar
lrwxrwxrwx  1 me users  16K Apr  8 17:51 my_other.jar -> /some/other/place.jar
```
Based on the example above, the following files would be instrumented:
  - `dotnet_file.dll`
  - `python_script.py`
  - `main.jar`

Ignored files:
  - `my_other.jar` - this will be ignored as we already encountered one symlink when traversing down from `opt/antithesis/catalog/more_files`.
