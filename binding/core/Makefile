
C=gcc
CC=g++
BINDING=core
os=linux

.PHONY: help clean


$(BINDING).so: ## compile shared library and dependencies
	$(CC) -fPIC $(CCARGS) $(OPT) -I$(LO_HOME) -I$(LO_HOME)/v8 -I$(LO_HOME)/v8/include $(WARN) -o $(BINDING).o $(BINDING).cc
	ar crsT $(BINDING).a $(BINDING).o 
ifeq ($(os),mac)
#	$(CC) $(LARGS) $(OPT) -dynamiclib $(WARN) -o $(BINDING).dylib $(BINDING).o -ldl 
	$(CC) $(LARGS) $(OPT) -shared $(WARN) -o $(BINDING).so $(BINDING).o -ldl 
else
	$(CC) $(LARGS) $(OPT) -shared $(WARN) -o $(BINDING).so $(BINDING).o -ldl 
endif

clean: ## tidy up
ifeq ($(os),win)
	@del /q $(BINDING).obj > NUL 2>&1
	@del /q $(BINDING).dll > NUL 2>&1
else
	rm -f $(BINDING).o
	rm -f $(BINDING).so
endif

all: ## make all
	make clean
	make $(BINDING).so

.DEFAULT_GOAL := help

