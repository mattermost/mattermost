.DEFAULT_GOAL := test

clean::
	rm -f *.diff *.out

test::
	@rm -f *.diff
	@./run_all.sh
	@printf "All tests ran successfully.\n"

