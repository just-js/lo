
C=gcc
CC=g++
BINDING=core

.PHONY: help clean


$(BINDING).a: ## compile static library and dependencies
	$(CC) -fPIC $(CCARGS) $(OPT) -I$(LO_HOME) -I$(LO_HOME)/v8 -I$(LO_HOME)/v8/include $(WARN) -o $(BINDING).o $(BINDING).cc
	ar crsT $(BINDING).a $(BINDING).o 

$(BINDING).so: $(BINDING).a ## compile shared library
ifeq ($(os),mac)
	$(CC) -fPIC $(LARGS) $(OPT) -dynamiclib $(WARN) -o $(BINDING).dylib $(BINDING).o -ldl  $(LO_HOME)/v8/libv8_monolith.a $(LO_HOME)/lo.o
else
	$(CC) $(LARGS) $(OPT) -shared $(WARN) -o $(BINDING).so $(BINDING).o -ldl 
endif

clean: ## tidy up
ifeq ($(os),win)
	@del /q $(BINDING).dll > NUL 2>&1
	@del /q $(BINDING).obj > NUL 2>&1
	@del /q $(BINDING).lib > NUL 2>&1
else
	rm -f $(BINDING).so
	rm -f $(BINDING).a
	rm -f $(BINDING).o
endif

all: ## make all
	make clean
	make $(BINDING).so

.DEFAULT_GOAL := help

