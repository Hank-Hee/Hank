-- Local rehearsal only: fail if app_runtime still owns or can access any surviving object.
drop role if exists app_runtime;
