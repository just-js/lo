
C=gcc
CC=g++
BINDING=core

.PHONY: help clean


binding: ## compile shared library and dependencies
	$(CC) -fPIC -c $(CCARGS) $(OPT) -I$(LO_HOME) -I$(LO_HOME)/v8 -I$(LO_HOME)/v8/include $(WARN) -o $(BINDING).o $(BINDING).cc
	ar crsT $(BINDING).a $(BINDING).o 
	$(CC) $(LARGS) $(OPT) -shared $(WARN) -o $(BINDING).so $(BINDING).o -ldl 

clean: ## tidy up
	rm -f $(BINDING).o
	rm -f $(BINDING).so
	
all: ## make all
	make clean
	make binding

.DEFAULT_GOAL := help

